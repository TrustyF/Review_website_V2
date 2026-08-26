// Shared by get-media.ts (tags its unstable_cache entries) and every action
// that needs to invalidate them (revalidateMediaPaths, plus the two mutation
// paths that touch cached media data without going through it — see
// updateMediaBannerFocus and deleteChangeLogEntry) — keeps the tag string
// itself in one place so the two sides can't drift.
export function mediaCacheTag(mediaId: number) {
	return `media:${mediaId}`;
}
