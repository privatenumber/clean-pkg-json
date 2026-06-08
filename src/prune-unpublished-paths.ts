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

/**
 * Recursively prunes `exports`/`imports` values, dropping `./`-relative
 * specifiers that won't be published. Returns the pruned value (or `undefined`
 * when nothing is left) along with the specifiers that were dropped.
 */
const prunePaths = (
	value: unknown,
	publishedFiles: Set<string>,
) => {
	const prunedSpecifiers: string[] = [];

	const pruneSpecifier = (specifier: string) => {
		if (!specifier.startsWith('./')) {
			return specifier;
		}
		if (specifierMatches(specifier, publishedFiles)) {
			return specifier;
		}
		prunedSpecifiers.push(specifier);
		return undefined;
	};

	const prune = (node: unknown): unknown | undefined => {
		if (node === null) {
			return null;
		}

		if (typeof node === 'string') {
			return pruneSpecifier(node);
		}

		if (Array.isArray(node)) {
			const kept = node.map(prune).filter(item => item !== undefined);
			return kept.length > 0 ? kept : undefined;
		}

		if (typeof node === 'object') {
			const kept: Record<string, unknown> = {};
			for (const [key, child] of Object.entries(node)) {
				const pruned = prune(child);
				if (pruned !== undefined) {
					kept[key] = pruned;
				}
			}
			return Object.keys(kept).length > 0 ? kept : undefined;
		}

		return node;
	};

	return {
		result: prune(value),
		prunedSpecifiers,
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
 * Of the dropped specifiers, finds the ones whose target file doesn't exist on
 * disk (likely an unbuilt artifact, rather than a deliberately excluded source
 * file). Only touches the filesystem within the package root's referenced scopes.
 */
const findMissingFiles = async (
	fs: FileSystem,
	cwd: string,
	prunedSpecifiers: string[],
) => {
	const missingFiles = new Set<string>();
	const directoryCache = new Map<string, string[]>();

	for (const specifier of prunedSpecifiers) {
		const exists = await targetExistsOnDisk(fs, cwd, specifier.slice(2), directoryCache);
		if (!exists) {
			missingFiles.add(specifier);
		}
	}

	return missingFiles;
};

const warnMissingFiles = (missingFiles: Set<string>) => {
	console.warn(yellow(
		'Removed exports/imports entries pointing to files that '
		+ `don't exist: ${Array.from(missingFiles).join(', ')}\n`
		+ 'If these are build outputs, build the package first.',
	));
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

	const prunedSpecifiers = new Set<string>();
	for (const field of fields) {
		const { result, prunedSpecifiers: dropped } = prunePaths(packageJson[field], publishedFiles);
		for (const specifier of dropped) {
			prunedSpecifiers.add(specifier);
		}

		if (result === undefined) {
			log(`Removing property "${field}" (no published files referenced)`);
			delete packageJson[field];
		} else {
			packageJson[field] = result;
		}
	}

	if (prunedSpecifiers.size === 0) {
		return;
	}

	const missingFiles = await findMissingFiles(fs, cwd, Array.from(prunedSpecifiers));
	if (missingFiles.size > 0) {
		warnMissingFiles(missingFiles);
	}
};
