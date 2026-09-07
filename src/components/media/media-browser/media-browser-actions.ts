"use server";
import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/asset-paths";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { requireAdmin } from "@/lib/auth/require-admin";

export type MediaBrowserSearchResult = {
	id: number;
	title: string;
	type: MediaType;
	posterSrc: string;
};

const SEARCH_LIMIT = 20;

// Same typo tolerance as search-actions.ts's FUSE_OPTIONS.
const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Fuzzy title search over the library, for any flow that needs to pick a media item and hand
// it off elsewhere. excludeMediaIds is caller-supplied (not a relational filter), so this stays usable outside list contexts.
export async function searchMediaBrowser(
	query: string,
	excludeMediaIds?: number[],
): Promise<MediaBrowserSearchResult[]> {
	await requireAdmin();
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			...(excludeMediaIds?.length ? { id: { notIn: excludeMediaIds } } : {}),
		},
		select: { id: true, title: true, type: true, posterPath: true },
		orderBy: { id: "asc" },
	});

	return fuzzySearch(candidates, FUSE_OPTIONS, trimmed, SEARCH_LIMIT).map(
		(m) => ({
			id: m.id,
			title: m.title,
			type: m.type,
			posterSrc: toPosterSrc(m.id, m.posterPath),
		}),
	);
}
