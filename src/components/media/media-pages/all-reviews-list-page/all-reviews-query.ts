import { dbPublic } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { EnrichmentStatus, Prisma } from "@prisma/client";

// Every reviewed item on the site can run into the hundreds — this page used
// to fetch every one of them (and every type-specific relation) in one
// unbounded query on every visit, most of which a visitor would never
// actually scroll to. Paginated in PAGE_SIZE-sized chunks instead:
// AllReviewsListPage (a Server Component) fetches the first page directly
// from loadReviewsPage below; AllReviewsFeed (a Client Component) fetches
// each subsequent one through all-reviews-actions.ts's loadMoreReviews —
// kept in a separate file since a "use server" file may only export async
// functions, not the plain PAGE_SIZE/loadReviewsPage this one also needs to
// share with the (non-"use server") Server Component.
export const PAGE_SIZE = 6;

// Every type-specific relation toMediaRecord might need — this list spans
// every media type, unlike RecentMediaListPage's single-type `include` prop.
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
// Review.reviewDate is "when the review text itself first existed" (see
// latest-activity-email.tsx's own comment on that definition); nulls: "last"
// pushes any row that predates reviewDate existing to the back instead of
// floating to the front ahead of genuinely recent reviews.
const REVIEWED_ORDER_BY: Prisma.MediaOrderByWithRelationInput[] = [
	{ review: { reviewDate: { sort: "desc", nulls: "last" } } },
	{ review: { createDate: "desc" } },
];

// Offset-based rather than cursor-based — REVIEWED_ORDER_BY sorts across two
// nullable columns, which Prisma's cursor pagination (a single unique-field
// comparison) can't directly express, and at this site's scale (a personal
// review catalog, not a firehose) skip/take's usual "a row shifting between
// pages" tradeoff is a non-issue in practice.
export async function loadReviewsPage(
	offset: number,
): Promise<{ media: MediaRecord[]; hasMore: boolean }> {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts.
	const rawList = await dbPublic.media.findMany({
		where: REVIEWED_WHERE,
		include: { ...EVERY_TYPE_RELATION, review: true },
		orderBy: REVIEWED_ORDER_BY,
		skip: offset,
		// One extra row fetched, then trimmed off below — cheaper than a
		// separate count query just to know whether a next page exists.
		take: PAGE_SIZE + 1,
	});

	const hasMore = rawList.length > PAGE_SIZE;
	return {
		media: rawList.slice(0, PAGE_SIZE).map(toMediaRecord),
		hasMore,
	};
}
