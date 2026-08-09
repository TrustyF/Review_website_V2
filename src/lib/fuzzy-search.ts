import Fuse, { IFuseOptions } from "fuse.js";

// Runs a Fuse search and unwraps the results down to the matched items
// themselves — the "new Fuse(...).search(query).slice(0, limit).map(({item}) =>
// item)" tail was identical in list-actions.ts's searchMediaForList and
// search-actions.ts's searchAllMedia, differing only in what each did with
// the items afterward. Building a fresh Fuse index per call (rather than
// caching it) matches what both call sites already did — candidates come
// from a DB query result that's different every call anyway.
export function fuzzySearch<T>(
	candidates: T[],
	options: IFuseOptions<T>,
	query: string,
	limit: number,
): T[] {
	return new Fuse(candidates, options)
		.search(query)
		.slice(0, limit)
		.map((result) => result.item);
}
