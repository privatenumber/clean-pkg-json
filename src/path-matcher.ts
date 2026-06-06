const STAR = '*';

export type PathMatcher = {
	// Literal parts of the pattern, split on `*`.
	segments: string[];

	// Number of `*` (segments.length - 1).
	starCount: number;

	// Combined length of all literal segments.
	literalLength: number;
};

export const createPathMatcher = (
	pattern: string,
): PathMatcher => {
	const segments = pattern.split(STAR);
	let literalLength = 0;
	for (const segment of segments) {
		literalLength += segment.length;
	}

	return {
		segments,
		starCount: segments.length - 1,
		literalLength,
	};
};

/**
 * Places each literal segment at its fixed offset (given the per-star value
 * length) and confirms every captured slice is identical.
 */
const segmentsAlign = (
	segments: string[],
	starCount: number,
	valueLength: number,
	filePath: string,
) => {
	let position = 0;
	let value: string | undefined;
	for (let index = 0; index < segments.length; index += 1) {
		const segment = segments[index];
		if (!filePath.startsWith(segment, position)) {
			return false;
		}
		position += segment.length;

		// A captured value follows every segment except the last.
		if (index < starCount) {
			const captured = filePath.slice(position, position + valueLength);
			if (value === undefined) {
				value = captured;
			} else if (value !== captured) {
				return false;
			}
			position += valueLength;
		}
	}

	return position === filePath.length;
};

/**
 * Whether a file path is a possible expansion of a `*` pattern. Per Node's
 * resolution, every `*` is replaced by the same captured value (which may
 * contain `/`), so the matched value's length is fixed by the path length.
 */
export const pathMatches = (
	{ segments, starCount, literalLength }: PathMatcher,
	filePath: string,
): boolean => {
	if (starCount === 0) {
		return filePath === segments[0];
	}

	// Single star (the common case): prefix + value + suffix. The length guard
	// rejects paths too short to fit a non-overlapping prefix and suffix.
	if (starCount === 1) {
		return (
			filePath.length >= literalLength
			&& filePath.startsWith(segments[0])
			&& filePath.endsWith(segments[1])
		);
	}

	// Multiple stars all bind to the same value, so its length is determined by
	// the leftover after the literals.
	const valueTotal = filePath.length - literalLength;
	if (valueTotal < 0 || valueTotal % starCount !== 0) {
		return false;
	}

	return segmentsAlign(segments, starCount, valueTotal / starCount, filePath);
};
