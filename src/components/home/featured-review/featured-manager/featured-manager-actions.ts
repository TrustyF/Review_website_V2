"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
// asset-paths.ts directly (not poster-resolver.ts) so this action's cold-start bundle skips sharp's native binary.
import { toPosterSrc } from "@/server/resolvers/asset-paths";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { requireAdmin } from "@/lib/auth/require-admin";

export type FeaturedReviewSummary = {
	id: number;
	title: string;
	type: string;
	posterSrc: string;
};

// Same ordering as the homepage's featured query, so this list reads in the order they'd appear in the hero.
const FEATURED_ORDER_BY = [
	{ review: { reviewDate: { sort: "desc" as const, nulls: "last" as const } } },
	{ review: { createDate: "desc" as const } },
];

// No enrichmentStatus/body filter, unlike the homepage query — this must show anything marked featured, even if it later lost its body/enrichment, so it can still be un-featured.
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

// Same typo tolerance as the other search actions.
const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Scoped to reviewed, not-yet-featured media, so results never overlap the "currently featured" list.
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

// A plain update, never a create — a review must already exist with a body to be featurable at all.
export async function setReviewFeatured(
	mediaId: number,
	featured: boolean,
): Promise<void> {
	await requireAdmin();
	await db.review.update({ where: { mediaId }, data: { featured } });
	// Only the homepage hero reads Review.featured, so no site-wide revalidation needed.
	revalidatePath("/");
}
