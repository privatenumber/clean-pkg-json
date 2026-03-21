// @ts-expect-error -- npm-packlist has no type declarations
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
	});
	return new Set(files);
};

const isRelativePath = (value: string) => value.startsWith('./');

const normalizePath = (value: string) => value.slice(2);

export const pruneUnpublishedPaths = (
	value: unknown,
	publishedFiles: Set<string>,
): unknown => {
	if (typeof value === 'string') {
		if (!isRelativePath(value)) {
			return value;
		}
		return publishedFiles.has(normalizePath(value)) ? value : null;
	}

	if (typeof value === 'object' && value !== null) {
		const record = value as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			const pruned = pruneUnpublishedPaths(record[key], publishedFiles);
			if (pruned === null) {
				delete record[key];
			} else {
				record[key] = pruned;
			}
		}
		return Object.keys(record).length > 0 ? record : null;
	}

	return value;
};
