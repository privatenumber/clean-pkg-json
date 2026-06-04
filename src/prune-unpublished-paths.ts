import { readdir } from 'node:fs/promises';
import path from 'node:path';
import packlist from 'npm-packlist';

const edgesOut = new Map();

export const getPublishedFiles = async (
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
 * All files that exist on disk, as posix relative paths (matching the format
 * returned by npm-packlist). Used to tell files that are excluded from the
 * published package apart from files that simply don't exist yet (e.g. build
 * artifacts that haven't been generated).
 */
export const getLocalFiles = async (cwd: string) => {
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

const wildcardMatchesAnyFile = (
	pattern: string,
	files: Set<string>,
) => {
	const normalized = pattern.slice(2);
	const prefix = normalized.slice(0, normalized.indexOf('*'));
	const suffix = normalized.slice(normalized.indexOf('*') + 1);

	return Array.from(files).some(
		file => file.startsWith(prefix) && file.endsWith(suffix),
	);
};

export const pruneUnpublishedPaths = (
	value: unknown,
	publishedFiles: Set<string>,
	localFiles: Set<string>,
) => {
	// Paths removed even though nothing matches on disk, likely unbuilt
	// artifacts rather than deliberately excluded source files.
	const removedMissingFiles: string[] = [];

	const pruneString = (node: string) => {
		if (!node.startsWith('./')) {
			return node;
		}

		if (node.includes('*')) {
			if (wildcardMatchesAnyFile(node, publishedFiles)) {
				return node;
			}
			if (!wildcardMatchesAnyFile(node, localFiles)) {
				removedMissingFiles.push(node);
			}
			return undefined;
		}

		const filePath = node.slice(2);
		if (publishedFiles.has(filePath)) {
			return node;
		}
		if (!localFiles.has(filePath)) {
			removedMissingFiles.push(node);
		}
		return undefined;
	};

	const prune = (node: unknown): unknown | undefined => {
		if (node === null) {
			return null;
		}

		if (typeof node === 'string') {
			return pruneString(node);
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
		removedMissingFiles,
	};
};
