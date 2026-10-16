// ||spoiler||, ![alt](url =WxH), [text](url), [spacer =N]; outside review-body.tsx ("use client") so server files can import it.
// Groups: 1 spoiler, 2-4 image alt/url/size, 5-6 link, 7-8 spacer/height. Image before link, spacer after it, or they misparse.
export const REVIEW_MARKUP_REGEX =
	/\|\|([\s\S]+?)\|\||!\[([^\]]*)\]\(([^)\s]+)(?:\s+=([^)\s]+))?\)|\[([^\]]+)\]\(([^)]+)\)|(\[spacer(?:\s+=(\d+))?\])/g;

// Image size after "=": "300", "300x", "x200", "300x200", "50%". Px unless suffixed with %.
const IMAGE_SIZE_REGEX = /^(\d+%?)?(?:x(\d+%?)?)?$/;

export function parseImageSize(size: string | undefined): {
	width?: string;
	height?: string;
} {
	const match = size ? IMAGE_SIZE_REGEX.exec(size) : null;
	if (!match) return {};
	const toCss = (value: string | undefined) =>
		value === undefined
			? undefined
			: value.endsWith("%")
				? value
				: `${value}px`;
	const width = toCss(match[1]);
	const height = toCss(match[2]);
	return {
		...(width ? { width } : {}),
		...(height ? { height } : {}),
	};
}
