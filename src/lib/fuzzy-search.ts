import Fuse, { IFuseOptions } from "fuse.js";

// Shared Fuse search + unwrap, deduped from two identical call sites.
// Builds a fresh index per call since candidates differ every call anyway.
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
