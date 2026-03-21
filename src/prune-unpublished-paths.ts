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

// Sentinel to distinguish "prune this" from "value is literally null"
const PRUNE = Symbol('prune');

const pruneValue = (
	value: unknown,
	publishedFiles: Set<string>,
): unknown => {
	if (value === null) {
		return null;
	}

	if (typeof value === 'string') {
		if (!value.startsWith('./')) {
			return value;
		}
		if (value.includes('*')) {
			return wildcardMatchesAnyFile(value, publishedFiles) ? value : PRUNE;
		}
		return publishedFiles.has(value.slice(2)) ? value : PRUNE;
	}

	if (Array.isArray(value)) {
		const filtered = value
			.map(item => pruneValue(item, publishedFiles))
			.filter(item => item !== PRUNE);
		return filtered.length > 0 ? filtered : PRUNE;
	}

	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			const pruned = pruneValue(record[key], publishedFiles);
			if (pruned === PRUNE) {
				delete record[key];
			} else {
				record[key] = pruned;
			}
		}
		return Object.keys(record).length > 0 ? record : PRUNE;
	}

	return value;
};

export const pruneUnpublishedPaths = (
	value: unknown,
	publishedFiles: Set<string>,
): unknown => {
	const result = pruneValue(value, publishedFiles);
	return result === PRUNE ? null : result;
};
