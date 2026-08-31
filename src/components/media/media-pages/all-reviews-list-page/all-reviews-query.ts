import { dbPublic } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { EnrichmentStatus, Prisma } from "@prisma/client";

// Paginated instead of fetching every reviewed item (and relation) unbounded on every visit. AllReviewsListPage fetches the first page from loadReviewsPage below; AllReviewsFeed fetches the rest via all-reviews-actions.ts's loadMoreReviews, kept in a separate "use server" file since such a file may only export async functions.
export const PAGE_SIZE = 6;

// Every type-specific relation toMediaRecord might need, spanning every media type.
const EVERY_TYPE_RELATION = {
	movie: true,
	tvShow: true,
	manga: true,
	comic: true,
	game: true,
	book: true,
} as const;

const REVIEWED_WHERE: Prisma.MediaWhereInput = {
	enrichmentStatus: EnrichmentStatus.DONE,
	review: { AND: [{ body: { not: null } }, { body: { not: "" } }] },
};
// nulls: "last" pushes rows predating reviewDate to the back instead of floating ahead of genuinely recent reviews.
const REVIEWED_ORDER_BY: Prisma.MediaOrderByWithRelationInput[] = [
	{ review: { reviewDate: { sort: "desc", nulls: "last" } } },
	{ review: { createDate: "desc" } },
];

// Offset-based, not cursor-based — REVIEWED_ORDER_BY sorts across two nullable columns, which Prisma's cursor pagination can't express, and skip/take's usual row-shift tradeoff is a non-issue at this site's scale.
export async function loadReviewsPage(
	offset: number,
): Promise<{ media: MediaRecord[]; hasMore: boolean }> {
	// dbPublic (not db) — soft-deleted media is excluded automatically.
	const rawList = await dbPublic.media.findMany({
		where: REVIEWED_WHERE,
		include: { ...EVERY_TYPE_RELATION, review: true },
		orderBy: REVIEWED_ORDER_BY,
		skip: offset,
		// One extra row fetched then trimmed below — cheaper than a separate count query.
		take: PAGE_SIZE + 1,
	});

	const hasMore = rawList.length > PAGE_SIZE;
	return {
		media: rawList.slice(0, PAGE_SIZE).map(toMediaRecord),
		hasMore,
	};
}
