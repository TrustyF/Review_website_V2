// Not in search-actions.ts: every export of a "use server" file is a public endpoint.
let version = 0;

export function invalidateSearchIndex() {
	version++;
}

export function getSearchIndexVersion() {
	return version;
}
