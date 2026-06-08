import { promises as nodeFs } from 'node:fs';
import path from 'node:path';
import { yellow } from 'ansis';
import packlist from 'npm-packlist';
import { createPathMatcher, pathMatches } from './path-matcher.ts';

type FileSystem = Pick<typeof nodeFs, 'stat' | 'readdir'>;

const edgesOut = new Map();

/**
 * Files that will be included in the published package, as posix relative paths.
 */
const getPublishedFiles = async (
	cwd: string,
	packageJson: Record<string, unknown>,
) => {
	const files: string[] = await packlist({
		path: cwd,
		package: packageJson,
		edgesOut,
		isProjectRoot: true,
	});
	return new Set(files);
};

/**
 * Whether a `./`-relative specifier resolves to a file in the set. The set
 * holds posix paths without the leading `./`.
 */
const specifierMatches = (
	specifier: string,
	files: Set<string>,
) => {
	const target = specifier.slice(2);
	if (!target.includes('*')) {
		return files.has(target);
	}

	const matcher = createPathMatcher(target);
	return Array.from(files).some(
		file => pathMatches(matcher, file),
	);
};

type RemovedEntry = {
	// Consumer-facing specifier the target was reached through, e.g. "pkg/sub".
	subpath: string;

	// Condition chain leading to the target, e.g. ["node", "require"].
	conditions: string[];

	// The `./`-relative target that was removed.
	target: string;
};

// The consumer-facing specifier for a subpath key. Exports resolve through the
// package name (`.` -> name, `./sub` -> name/sub); imports keys are used as-is.
const resolveSubpath = (
	subpathKey: string,
	packageName: string | undefined,
	isExports: boolean,
) => {
	if (!isExports || !packageName) {
		return subpathKey;
	}
	return subpathKey === '.' ? packageName : packageName + subpathKey.slice(1);
};

// Whether the top-level value maps subpaths (vs. being conditions sugar for
// "."). Imports are always a subpath map; exports are when keys start with ".".
const isSubpathMap = (
	value: Record<string, unknown>,
	isExports: boolean,
) => {
	const keys = Object.keys(value);
	return keys.length > 0 && (!isExports || keys[0].startsWith('.'));
};

/**
 * Prunes an `exports`/`imports` field, dropping `./`-relative targets that
 * won't be published. Returns the pruned value (or `undefined` when nothing is
 * left) and a record of each dropped target with the subpath and conditions it
 * was reached through.
 */
const pruneField = (
	value: unknown,
	publishedFiles: Set<string>,
	packageName: string | undefined,
	isExports: boolean,
) => {
	const removed: RemovedEntry[] = [];

	const pruneLeaf = (specifier: string, subpath: string, conditions: string[]) => {
		if (!specifier.startsWith('./')) {
			return specifier;
		}
		if (specifierMatches(specifier, publishedFiles)) {
			return specifier;
		}
		removed.push({
			subpath,
			conditions,
			target: specifier,
		});
		return undefined;
	};

	// Prunes a target (string | conditions object | fallback array | null)
	// reached via `subpath` under `conditions`.
	const pruneTarget = (
		node: unknown,
		subpath: string,
		conditions: string[],
	): unknown | undefined => {
		if (node === null) {
			return null;
		}

		if (typeof node === 'string') {
			return pruneLeaf(node, subpath, conditions);
		}

		if (Array.isArray(node)) {
			const kept = node
				.map(item => pruneTarget(item, subpath, conditions))
				.filter(item => item !== undefined);
			return kept.length > 0 ? kept : undefined;
		}

		if (typeof node === 'object') {
			const kept: Record<string, unknown> = {};
			for (const [condition, child] of Object.entries(node)) {
				const pruned = pruneTarget(child, subpath, [...conditions, condition]);
				if (pruned !== undefined) {
					kept[condition] = pruned;
				}
			}
			return Object.keys(kept).length > 0 ? kept : undefined;
		}

		return node;
	};

	if (
		typeof value === 'object'
		&& value !== null
		&& !Array.isArray(value)
		&& isSubpathMap(value as Record<string, unknown>, isExports)
	) {
		const kept: Record<string, unknown> = {};
		for (const [subpathKey, target] of Object.entries(value)) {
			const subpath = resolveSubpath(subpathKey, packageName, isExports);
			const pruned = pruneTarget(target, subpath, []);
			if (pruned !== undefined) {
				kept[subpathKey] = pruned;
			}
		}
		return {
			result: Object.keys(kept).length > 0 ? kept : undefined,
			removed,
		};
	}

	// Sugar: the whole value is the target for the "." subpath.
	return {
		result: pruneTarget(value, resolveSubpath('.', packageName, isExports), []),
		removed,
	};
};

const fileExists = async (
	fs: FileSystem,
	filePath: string,
) => {
	try {
		await fs.stat(filePath);
		return true;
	} catch {
		return false;
	}
};

const ignoredDirectories = new Set(['node_modules', '.git']);

/**
 * Lists files (posix paths relative to `cwd`) under a directory, skipping
 * `node_modules`/`.git` (which can't appear in export targets and would bloat
 * the scan). Returns an empty list if the directory doesn't exist; never throws.
 */
const listFilesUnder = async (
	fs: FileSystem,
	cwd: string,
	directory: string,
) => {
	const files: string[] = [];

	const walk = async (current: string) => {
		let entries;
		try {
			entries = await fs.readdir(current, { withFileTypes: true });
		} catch {
			return;
		}

		await Promise.all(
			entries.map(async (entry) => {
				if (entry.isDirectory()) {
					if (!ignoredDirectories.has(entry.name)) {
						await walk(path.join(current, entry.name));
					}
					return;
				}

				if (entry.isFile()) {
					const filePath = path.relative(cwd, path.join(current, entry.name));
					files.push(filePath.split(path.sep).join('/'));
				}
			}),
		);
	};

	await walk(directory);
	return files;
};

// A resolved path is within the package only if it's the root or under it.
// Targets that escape (via `../`) are invalid per Node and never published.
const isWithin = (root: string, resolved: string) => (
	resolved === root || resolved.startsWith(root + path.sep)
);

const targetExistsOnDisk = async (
	fs: FileSystem,
	cwd: string,
	target: string,
	directoryCache: Map<string, string[]>,
) => {
	if (!target.includes('*')) {
		const resolved = path.resolve(cwd, target);
		return isWithin(cwd, resolved) && fileExists(fs, resolved);
	}

	const matcher = createPathMatcher(target);
	// The literal prefix (before the first `*`) bounds the directory we scan,
	// so we never read the whole tree.
	const prefix = matcher.segments[0];
	const lastSlash = prefix.lastIndexOf('/');
	const scope = lastSlash === -1 ? '.' : prefix.slice(0, lastSlash);
	const directory = path.resolve(cwd, scope);
	if (!isWithin(cwd, directory)) {
		return false;
	}

	let files = directoryCache.get(directory);
	if (!files) {
		files = await listFilesUnder(fs, cwd, directory);
		directoryCache.set(directory, files);
	}
	return files.some(file => pathMatches(matcher, file));
};

/**
 * Of the dropped entries, finds the ones whose target doesn't exist on disk
 * (likely an unbuilt artifact, rather than a deliberately excluded source
 * file). Only touches the filesystem within the package root's referenced
 * scopes, and checks each distinct target once.
 */
const findMissingEntries = async (
	fs: FileSystem,
	cwd: string,
	removed: RemovedEntry[],
) => {
	const missing: RemovedEntry[] = [];
	const directoryCache = new Map<string, string[]>();
	const existenceCache = new Map<string, boolean>();

	for (const entry of removed) {
		let exists = existenceCache.get(entry.target);
		if (exists === undefined) {
			exists = await targetExistsOnDisk(fs, cwd, entry.target.slice(2), directoryCache);
			existenceCache.set(entry.target, exists);
		}
		if (!exists) {
			missing.push(entry);
		}
	}

	return missing;
};

const warnRemovedEntry = ({ subpath, conditions, target }: RemovedEntry) => {
	const conditionsText = conditions.length > 0
		? ` with conditions ${conditions.join(' + ')}`
		: '';
	console.warn(
		`${yellow('⚠️ Warning:')} ${subpath}${conditionsText} `
		+ `was removed because ${target} doesn't exist`,
	);
};

/**
 * Prunes `imports`/`exports` entries that point to files which won't be in the
 * published package, mutating `packageJson` in place. Warns about entries
 * removed because their target file doesn't exist on disk (likely unbuilt).
 */
export const pruneUnpublishedPaths = async (
	cwd: string,
	packageJson: Record<string, unknown>,
	log: (message: string) => void,
	fs: FileSystem = nodeFs,
) => {
	const fields = ['imports', 'exports'].filter(field => packageJson[field]);
	if (fields.length === 0) {
		return;
	}

	const publishedFiles = await getPublishedFiles(cwd, packageJson);
	const packageName = typeof packageJson.name === 'string' ? packageJson.name : undefined;

	const removed: RemovedEntry[] = [];
	for (const field of fields) {
		const { result, removed: fieldRemoved } = pruneField(
			packageJson[field],
			publishedFiles,
			packageName,
			field === 'exports',
		);
		removed.push(...fieldRemoved);

		if (result === undefined) {
			log(`Removing property "${field}" (no published files referenced)`);
			delete packageJson[field];
		} else {
			packageJson[field] = result;
		}
	}

	if (removed.length === 0) {
		return;
	}

	const missing = await findMissingEntries(fs, cwd, removed);
	for (const entry of missing) {
		warnRemovedEntry(entry);
	}
};
