"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/poster-resolver";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { requireAdmin } from "@/lib/auth/require-admin";

export type FeaturedReviewSummary = {
	id: number;
	title: string;
	type: string;
	posterSrc: string;
};

// Same reviewDate/createDate ordering as the homepage's own featured query
// (see app/page.tsx's REVIEWED_ORDER_BY) — the modal's "currently featured"
// list reads in the same order they'd actually appear in the hero.
const FEATURED_ORDER_BY = [
	{ review: { reviewDate: { sort: "desc" as const, nulls: "last" as const } } },
	{ review: { createDate: "desc" as const } },
];

// No enrichmentStatus/body filter here on purpose, unlike the homepage
// query — this is the admin's ground truth of what's currently marked
// featured, including anything that's since lost its body or enrichment
// (so it can still be found and un-featured), not just what the hero would
// actually render.
export async function getFeaturedReviews(): Promise<FeaturedReviewSummary[]> {
	await requireAdmin();
	const media = await dbPublic.media.findMany({
		where: { review: { featured: true } },
		select: { id: true, title: true, type: true, posterPath: true },
		orderBy: FEATURED_ORDER_BY,
	});
	return media.map((m) => ({
		id: m.id,
		title: m.title,
		type: m.type,
		posterSrc: toPosterSrc(m.id, m.posterPath),
	}));
}

const SEARCH_LIMIT = 20;

// Same typo tolerance as list-actions.ts's searchMediaForList/search-actions.ts's
// searchAllMedia.
const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Fuzzy title search, scoped to media that could actually be featured next —
// reviewed (a non-empty body, same requirement the hero itself has) and not
// already featured, so a result here is always something the "Add" button
// can act on without the two lists ever showing the same item twice.
export async function searchUnfeaturedReviews(
	query: string,
): Promise<FeaturedReviewSummary[]> {
	await requireAdmin();
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			review: {
				featured: false,
				AND: [{ body: { not: null } }, { body: { not: "" } }],
			},
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

// The one place featured actually gets toggled — Review.mediaId is @unique,
// same as saveReview's own upsert, so this is a plain update (never a
// create: a review has to already exist with a body to be searchable/
// featurable in the first place, see searchUnfeaturedReviews above).
export async function setReviewFeatured(
	mediaId: number,
	featured: boolean,
): Promise<void> {
	await requireAdmin();
	await db.review.update({ where: { mediaId }, data: { featured } });
	revalidatePath("/", "layout");
}
