import { existsSync } from 'node:fs';
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

const wildcardMatchesAnyFile = (
	pattern: string,
	publishedFiles: Set<string>,
) => {
	const normalized = pattern.slice(2);
	const prefix = normalized.slice(0, normalized.indexOf('*'));
	const suffix = normalized.slice(normalized.indexOf('*') + 1);

	return Array.from(publishedFiles).some(
		file => file.startsWith(prefix) && file.endsWith(suffix),
	);
};

export const pruneUnpublishedPaths = (
	value: unknown,
	publishedFiles: Set<string>,
	cwd: string,
) => {
	// Paths removed even though the file isn't on disk, likely an unbuilt
	// artifact rather than a deliberately excluded source file.
	const removedMissingFiles: string[] = [];

	const pruneString = (node: string) => {
		if (!node.startsWith('./')) {
			return node;
		}
		if (node.includes('*')) {
			return wildcardMatchesAnyFile(node, publishedFiles) ? node : undefined;
		}

		const filePath = node.slice(2);
		if (publishedFiles.has(filePath)) {
			return node;
		}

		if (!existsSync(path.resolve(cwd, filePath))) {
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
