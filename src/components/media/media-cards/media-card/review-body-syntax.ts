// Kept out of review-body.tsx (a "use client" file) so a "use server" file can still import this regex.
// ||text|| marks a spoiler, ![alt](url) embeds an image, [text](url) makes text a link. No nesting, no other Markdown.
// Groups: 1 spoiler text, 2 image alt, 3 image url, 4 link text, 5 link url. Image must precede link or [alt](url) matches first.
export const REVIEW_MARKUP_REGEX =
	/\|\|([\s\S]+?)\|\||!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
