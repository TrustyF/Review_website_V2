"use server";
import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/poster-resolver";
import { fuzzySearch } from "@/lib/fuzzy-search";

export type GlobalSearchResult = {
	id: number;
	title: string;
	type: MediaType;
	posterSrc: string;
	releaseDate: Date | null;
};

const SEARCH_LIMIT = 8;

// Same typo tolerance as everywhere else fuzzy search happens in this app
// (list-actions.ts, the old per-page search) — 0.35 survives a couple of
// wrong/missing letters without turning every query into a firehose of
// unrelated results.
const FUSE_OPTIONS = {
	keys: [
		{ name: "title", weight: 0.6 },
		{ name: "alternateTitle", weight: 0.2 },
		{ name: "directors", weight: 0.1 },
		{ name: "studios", weight: 0.1 },
	],
	threshold: 0.35,
	ignoreLocation: true,
};

// Media-agnostic fuzzy search across the whole collection, for the navbar's
// jump-to-anything search — unlike MediaFilterGrid's old per-page search,
// this isn't scoped to one type or one already-loaded list. Same in-memory
// Fuse-over-a-select pattern as list-actions.ts's searchMediaForList: fine
// at this app's scale (a personal collection, not a public catalog), and a
// quick "jump to a title" tool doesn't need overview-text matches the way
// the old per-page search did, so that field isn't fetched here at all —
// keeps the per-keystroke payload lighter.
export async function searchAllMedia(
	query: string,
): Promise<GlobalSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE },
		select: {
			id: true,
			title: true,
			alternateTitle: true,
			type: true,
			posterPath: true,
			releaseDate: true,
			// Director/Studio only — enough for relevance, without pulling
			// every crew job for every item in the collection.
			credits: {
				where: { role: { name: { in: ["Director", "Studio"] } } },
				select: {
					person: { select: { name: true } },
					company: { select: { name: true } },
				},
			},
		},
		orderBy: { id: "asc" },
	});

	const searchable = candidates.map((m) => ({
		...m,
		directors: m.credits
			.map((c) => c.person?.name)
			.filter((name): name is string => name != null),
		studios: m.credits
			.map((c) => c.company?.name)
			.filter((name): name is string => name != null),
	}));

	return fuzzySearch(searchable, FUSE_OPTIONS, trimmed, SEARCH_LIMIT).map(
		(m) => ({
			id: m.id,
			title: m.title,
			type: m.type,
			releaseDate: m.releaseDate,
			posterSrc: toPosterSrc(m.id, m.posterPath),
		}),
	);
}
