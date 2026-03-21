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
): unknown | undefined => {
	if (value === null) {
		return null;
	}

	if (typeof value === 'string') {
		if (!value.startsWith('./')) {
			return value;
		}
		if (value.includes('*')) {
			return wildcardMatchesAnyFile(value, publishedFiles) ? value : undefined;
		}
		return publishedFiles.has(value.slice(2)) ? value : undefined;
	}

	if (Array.isArray(value)) {
		const kept = value
			.map(item => pruneUnpublishedPaths(item, publishedFiles))
			.filter(item => item !== undefined);
		return kept.length > 0 ? kept : undefined;
	}

	if (typeof value === 'object') {
		const kept: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value)) {
			const pruned = pruneUnpublishedPaths(child, publishedFiles);
			if (pruned !== undefined) {
				kept[key] = pruned;
			}
		}
		return Object.keys(kept).length > 0 ? kept : undefined;
	}

	return value;
};
