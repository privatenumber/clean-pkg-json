const STAR = '*';

export type PathMatcher = {
	prefix: string;
	middle: string[];
	suffix: string;
};

/**
 * Parses a `*` pattern (e.g. `dist/*.js`) into prefix/middle/suffix segments
 * once, so it can be matched against many file paths cheaply.
 */
export const createPathMatcher = (
	pattern: string,
): PathMatcher => {
	const segments = pattern.split(STAR);
	const lastIndex = segments.length - 1;
	return {
		prefix: segments[0],
		middle: segments.slice(1, lastIndex),
		suffix: segments[lastIndex],
	};
};

/**
 * Matches a file path against a parsed pattern, returning the `*` capture
 * (which may be an empty string) or `undefined` when it doesn't match. Multiple
 * stars must capture the same value.
 */
export const pathMatches = (
	{ prefix, middle, suffix }: PathMatcher,
	filePath: string,
): string | undefined => {
	if (
		!filePath.startsWith(prefix)
		|| !filePath.endsWith(suffix)
	) {
		return;
	}

	const inner = filePath.slice(prefix.length, -suffix.length || undefined);
	if (middle.length === 0) {
		return inner;
	}

	let lastIndex = 0;
	let starValue = '';
	for (const segment of middle) {
		const segmentIndex = inner.indexOf(segment, lastIndex);
		if (segmentIndex === -1) {
			return;
		}

		const extracted = inner.slice(lastIndex, segmentIndex);
		if (!starValue) {
			starValue = extracted;
		} else if (starValue !== extracted) {
			return;
		}

		lastIndex = segmentIndex + segment.length;
	}

	// The final star (after the last fixed segment) must match the same value.
	if (inner.slice(lastIndex) !== starValue) {
		return;
	}

	return starValue;
};
