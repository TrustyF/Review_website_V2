// The one place that defines what counts as review-body markup — kept out
// of review-body.tsx specifically because that file is "use client", and
// Next treats every export from a client module as client-only (see
// poster-ratio.ts for the same reasoning), so a "use server" file
// (media-editor-actions.ts) couldn't import a regex from there directly.
//
// ||text|| marks a spoiler, [text](url) makes text a link. No nesting, no
// other Markdown — this is typed straight into a plain textarea, not a rich
// text editor.
export const REVIEW_MARKUP_REGEX =
	/\|\|([\s\S]+?)\|\||\[([^\]]+)\]\(([^)]+)\)/g;
