import { promises as fs } from 'node:fs';
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
 * returned by npm-packlist). Used to distinguish files that are excluded from
 * the published package from files that simply don't exist yet (e.g. build
 * artifacts that haven't been generated).
 */
export const getLocalFiles = async (cwd: string) => {
	const files = new Set<string>();

	const walk = async (directory: string) => {
		const entries = await fs.readdir(directory, { withFileTypes: true });
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
	const starIndex = normalized.indexOf('*');
	const prefix = normalized.slice(0, starIndex);
	const suffix = normalized.slice(starIndex + 1);

	return Array.from(files).some(
		file => file.startsWith(prefix) && file.endsWith(suffix),
	);
};

/**
 * A relative path should be kept unless it points to a file that exists on disk
 * but is excluded from the published package (e.g. a source file referenced by a
 * dev-only condition). Paths whose targets don't exist on disk are kept, since
 * they may be build artifacts that haven't been generated yet.
 */
const isPathPublishable = (
	value: string,
	publishedFiles: Set<string>,
	localFiles: Set<string>,
) => {
	if (value.includes('*')) {
		return (
			wildcardMatchesAnyFile(value, publishedFiles)
			|| !wildcardMatchesAnyFile(value, localFiles)
		);
	}

	const filePath = value.slice(2);
	return publishedFiles.has(filePath) || !localFiles.has(filePath);
};

export const pruneUnpublishedPaths = (
	value: unknown,
	publishedFiles: Set<string>,
	localFiles: Set<string>,
): unknown | undefined => {
	if (value === null) {
		return null;
	}

	if (typeof value === 'string') {
		if (!value.startsWith('./')) {
			return value;
		}
		return isPathPublishable(value, publishedFiles, localFiles) ? value : undefined;
	}

	if (Array.isArray(value)) {
		const kept = value
			.map(item => pruneUnpublishedPaths(item, publishedFiles, localFiles))
			.filter(item => item !== undefined);
		return kept.length > 0 ? kept : undefined;
	}

	if (typeof value === 'object') {
		const kept: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value)) {
			const pruned = pruneUnpublishedPaths(child, publishedFiles, localFiles);
			if (pruned !== undefined) {
				kept[key] = pruned;
			}
		}
		return Object.keys(kept).length > 0 ? kept : undefined;
	}

	return value;
};
