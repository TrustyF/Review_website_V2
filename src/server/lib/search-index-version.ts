// Separate from search-query.ts so admin actions can invalidate without loading Fuse.
let version = 0;

export function invalidateSearchIndex() {
	version++;
}

export function getSearchIndexVersion() {
	return version;
}
