import { dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { LazyMediaList } from "@/components/media/media-grids/lazy-media-list/lazy-media-list";
import { GroupedMediaList } from "@/components/media/media-grids/grouped-media-list/grouped-media-list";
import { groupMediaByReviewMonth } from "@/components/media/media-pages/all-reviews-list-page/group-by-review-month";
import { EnrichmentStatus } from "@prisma/client";
import styles from "./all-reviews-list-page.module.sass";

// Every type-specific relation toMediaRecord might need — this list spans
// every media type, unlike RecentMediaListPage's single-type `include`
// prop. Mirrors src/app/page.tsx's own EVERY_TYPE_RELATION; not pulled out
// as a shared export since these are the only two callers and duplicating
// one object literal is simpler than threading a shared constant through a
// third file just for this.
const EVERY_TYPE_RELATION = {
	movie: true,
	tvShow: true,
	manga: true,
	comic: true,
	game: true,
	book: true,
} as const;

// Code-level switch, not a user-facing control — flip to render the whole
// list bucketed into one collapsible group per calendar month (via
// GroupedMediaList/groupMediaByReviewMonth) instead of one flat list.
const GROUP_BY_MONTH = true;

// Every reviewed item on the site, sorted by review date — the unbounded
// version of what FeaturedReview's picker only ever shows a handful of.
// Same where/orderBy as the home page's own "reviewed" query
// (src/app/page.tsx), just without its `take` cap. LazyMediaList (the full
// MediaCardShell card, not the compact mini card — the review text itself
// is the point of this page) handles revealing it in batches as the page
// scrolls, either flat or per-month depending on GROUP_BY_MONTH.
export async function AllReviewsListPage() {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts.
	const rawList = await dbPublic.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			review: { AND: [{ body: { not: null } }, { body: { not: "" } }] },
		},
		include: { ...EVERY_TYPE_RELATION, review: true },
		// Same tie-break as the home page: Review.reviewDate is "when the
		// review text itself first existed" (see latest-activity-email.tsx's
		// own comment on that definition); nulls: "last" pushes any row that
		// predates reviewDate existing to the back instead of floating to the
		// front ahead of genuinely recent reviews.
		orderBy: [
			{ review: { reviewDate: { sort: "desc", nulls: "last" } } },
			{ review: { createDate: "desc" } },
		],
	});
	const mediaList = rawList.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			{/*<div className={styles.header}>*/}
			{/*	<h1>Reviews</h1>*/}
			{/*</div>*/}
			{GROUP_BY_MONTH ? (
				<GroupedMediaList groups={groupMediaByReviewMonth(mediaList)} />
			) : (
				<LazyMediaList items={mediaList} restoreKey="all-reviews" />
			)}
		</div>
	);
}
