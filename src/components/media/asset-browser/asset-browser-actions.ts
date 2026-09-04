"use server";
import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/asset-paths";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { requireAdmin } from "@/lib/auth/require-admin";

export type AssetBrowserSearchResult = {
	id: number;
	title: string;
	type: MediaType;
	posterSrc: string;
	externalId: string | null;
};

const SEARCH_LIMIT = 20;

// Same typo tolerance as search-actions.ts's FUSE_OPTIONS.
const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Unscoped title search across the whole library — unlike list-actions'
// searchMediaForList, nothing here excludes already-used media, since
// AssetBrowser is about borrowing a title's art for some other context, not
// building a list of titles.
export async function searchMediaLibrary(
	query: string,
): Promise<AssetBrowserSearchResult[]> {
	await requireAdmin();
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE },
		select: {
			id: true,
			title: true,
			type: true,
			posterPath: true,
			externalId: true,
		},
		orderBy: { id: "asc" },
	});

	return fuzzySearch(candidates, FUSE_OPTIONS, trimmed, SEARCH_LIMIT).map(
		(m) => ({
			id: m.id,
			title: m.title,
			type: m.type,
			posterSrc: toPosterSrc(m.id, m.posterPath),
			externalId: m.externalId,
		}),
	);
}
