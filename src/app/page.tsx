import { dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { FeaturedReview } from "@/components/home/featured-review/featured-review";
import { RecentReviewsSection } from "@/components/home/recent-reviews-section/recent-reviews-section";
import { RecentMoviesSection } from "@/components/home/recent-movies-section/recent-movies-section";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import styles from "./page.module.sass";

const RECENT_REVIEWS_COUNT = 6;
const RECENT_MOVIES_COUNT = 14;

// Every type-specific relation toMediaRecord might need — the reviewed feed
// spans every media type, unlike RecentMoviesSection's own query below
// which only ever needs `movie`.
const EVERY_TYPE_RELATION = {
	movie: true,
	tvShow: true,
	manga: true,
	comic: true,
	game: true,
	book: true,
} as const;

export default async function HomePage() {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts. The two queries don't depend on each other, so
	// there's no reason to make one wait on the other.
	const [reviewed, recentMoviesRaw] = await Promise.all([
		// Ordered by Review.reviewDate — "when the review text itself first
		// existed", the same "latest review" definition latest-activity-
		// email.tsx's own comment describes. nulls: "last" pushes any row that
		// predates reviewDate existing (body set, reviewDate never backfilled)
		// to the back instead of floating to the front ahead of genuinely
		// recent reviews.
		dbPublic.media.findMany({
			where: {
				enrichmentStatus: EnrichmentStatus.DONE,
				review: { AND: [{ body: { not: null } }, { body: { not: "" } }] },
			},
			include: { ...EVERY_TYPE_RELATION, review: true },
			orderBy: [
				{ review: { reviewDate: { sort: "desc", nulls: "last" } } },
				{ review: { createDate: "desc" } },
			],
			take: 1 + RECENT_REVIEWS_COUNT,
		}),
		// Separate from the reviewed feed above — this is "what's new on the
		// site" (by releaseDate, same as RecentMediaListPage), not "what was
		// reviewed most recently", so a movie can appear here whether or not
		// it has a review yet.
		dbPublic.media.findMany({
			where: { type: MediaType.MOVIE, enrichmentStatus: EnrichmentStatus.DONE },
			include: { movie: true, review: true },
			orderBy: { releaseDate: "desc" },
			take: RECENT_MOVIES_COUNT,
		}),
	]);

	const reviewedList = reviewed.map(toMediaRecord);
	const [featured, ...recentReviews] = reviewedList;
	const recentMovies = recentMoviesRaw.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			{featured && <FeaturedReview media={featured} />}
			<RecentReviewsSection items={recentReviews} />
			<RecentMoviesSection items={recentMovies} />
		</div>
	);
}
