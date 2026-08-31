// Kept out of review-body.tsx (a "use client" file) so a "use server" file can still import this regex.
// ||text|| marks a spoiler, [text](url) makes text a link. No nesting, no other Markdown.
export const REVIEW_MARKUP_REGEX =
	/\|\|([\s\S]+?)\|\||\[([^\]]+)\]\(([^)]+)\)/g;
