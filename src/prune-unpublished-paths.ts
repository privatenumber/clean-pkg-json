import { readdir } from 'node:fs/promises';
import path from 'node:path';
import packlist from 'npm-packlist';

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

const ignoredDirectories = new Set(['node_modules', '.git']);

/**
 * Files that exist on disk, as posix relative paths. Lets us tell files that
 * are excluded from the published package apart from files that don't exist
 * yet (e.g. build artifacts that haven't been generated).
 */
const getLocalFiles = async (cwd: string) => {
	const files = new Set<string>();

	const walk = async (directory: string) => {
		const entries = await readdir(directory, { withFileTypes: true });
		await Promise.all(
			entries.map(async (entry) => {
				if (entry.isDirectory()) {
					if (!ignoredDirectories.has(entry.name)) {
						await walk(path.join(directory, entry.name));
					}
					return;
				}

				if (entry.isFile()) {
					const relativePath = path.relative(cwd, path.join(directory, entry.name));
					files.add(relativePath.split(path.sep).join('/'));
				}
			}),
		);
	};

	await walk(cwd);
	return files;
};

/**
 * Whether a `./`-relative specifier resolves to any file in the set. Handles
 * both exact paths and `*` wildcard patterns (matched by prefix and suffix).
 */
const pathMatchesFile = (
	specifier: string,
	files: Set<string>,
) => {
	const normalized = specifier.slice(2);
	const star = normalized.indexOf('*');
	if (star === -1) {
		return files.has(normalized);
	}

	const prefix = normalized.slice(0, star);
	const suffix = normalized.slice(star + 1);
	return Array.from(files).some(
		file => file.startsWith(prefix) && file.endsWith(suffix),
	);
};

type PruneContext = {
	publishedFiles: Set<string>;
	localFiles: Set<string>;

	// Removed specifiers with no on-disk match, collected for the warning.
	missingFiles: Set<string>;
};

/**
 * Decides the fate of a single `./`-relative specifier: kept if it will be
 * published, otherwise dropped (and flagged as missing when nothing matches it
 * on disk). Non-relative specifiers (e.g. bare package names) are left as-is.
 */
const pruneSpecifier = (
	specifier: string,
	context: PruneContext,
) => {
	if (!specifier.startsWith('./')) {
		return specifier;
	}
	if (pathMatchesFile(specifier, context.publishedFiles)) {
		return specifier;
	}
	if (!pathMatchesFile(specifier, context.localFiles)) {
		context.missingFiles.add(specifier);
	}
	return undefined;
};

/**
 * Recursively prunes `exports`/`imports` values, dropping specifiers that won't
 * be published. Returns the pruned value, or `undefined` when nothing is left.
 */
const prunePaths = (
	value: unknown,
	context: PruneContext,
): unknown | undefined => {
	if (value === null) {
		return null;
	}

	if (typeof value === 'string') {
		return pruneSpecifier(value, context);
	}

	if (Array.isArray(value)) {
		const kept = value
			.map(item => prunePaths(item, context))
			.filter(item => item !== undefined);
		return kept.length > 0 ? kept : undefined;
	}

	if (typeof value === 'object') {
		const kept: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value)) {
			const pruned = prunePaths(child, context);
			if (pruned !== undefined) {
				kept[key] = pruned;
			}
		}
		return Object.keys(kept).length > 0 ? kept : undefined;
	}

	return value;
};

const warnMissingFiles = (missingFiles: Set<string>) => {
	console.warn(
		'clean-pkg-json: removed exports/imports entries pointing to files that '
		+ `don't exist: ${Array.from(missingFiles).join(', ')}\n`
		+ 'If these are build outputs, run clean-pkg-json after building.',
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
) => {
	const fields = ['imports', 'exports'].filter(field => packageJson[field]);
	if (fields.length === 0) {
		return;
	}

	const [publishedFiles, localFiles] = await Promise.all([
		getPublishedFiles(cwd, packageJson),
		getLocalFiles(cwd),
	]);
	const context: PruneContext = {
		publishedFiles,
		localFiles,
		missingFiles: new Set(),
	};

	for (const field of fields) {
		const pruned = prunePaths(packageJson[field], context);
		if (pruned === undefined) {
			log(`Removing property "${field}" (no published files referenced)`);
			delete packageJson[field];
		} else {
			packageJson[field] = pruned;
		}
	}

	if (context.missingFiles.size > 0) {
		warnMissingFiles(context.missingFiles);
	}
};
