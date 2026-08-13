import { dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { FeaturedReview } from "@/components/home/featured-review/featured-review";
import { RecentMoviesSection } from "@/components/home/recent-movies-section/recent-movies-section";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import styles from "./page.module.sass";

// How many extra reviewed items ride along in FeaturedReview's own picker
// strip, beyond the featured one itself.
const RECENT_REVIEWS_COUNT = 6;
const RECENT_MOVIES_COUNT = 14;
// "Recent movies" is scoped to genuinely recent releases, not just
// whatever's newest on the site — see getRecentMovies.
const RECENT_MOVIES_MONTHS = 5;
// Floor so the section never looks sparse right after a quiet stretch —
// if fewer than this many releases fall inside the window, the date
// filter is dropped entirely (see getRecentMovies).
const MIN_RECENT_MOVIES = 7;

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

// "What's new on the site" (by releaseDate, same as RecentMediaListPage),
// not "what was reviewed most recently" — a movie can appear here whether
// or not it has a review yet. Scoped to the last RECENT_MOVIES_MONTHS so a
// quiet stretch doesn't dredge up an old release, but never below
// MIN_RECENT_MOVIES — if the window doesn't have enough, the date filter is
// dropped entirely rather than showing a half-empty section.
async function getRecentMovies() {
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - RECENT_MOVIES_MONTHS);

	const recent = await dbPublic.media.findMany({
		where: {
			type: MediaType.MOVIE,
			enrichmentStatus: EnrichmentStatus.DONE,
			releaseDate: { gte: cutoff },
		},
		include: { movie: true, review: true },
		orderBy: { releaseDate: "desc" },
		take: RECENT_MOVIES_COUNT,
	});
	if (recent.length >= MIN_RECENT_MOVIES) return recent;

	return dbPublic.media.findMany({
		where: { type: MediaType.MOVIE, enrichmentStatus: EnrichmentStatus.DONE },
		include: { movie: true, review: true },
		orderBy: { releaseDate: "desc" },
		take: MIN_RECENT_MOVIES,
	});
}

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
		getRecentMovies(),
	]);

	const reviewedList = reviewed.map(toMediaRecord);
	const recentMovies = recentMoviesRaw.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<FeaturedReview items={reviewedList} />
			<RecentMoviesSection items={recentMovies} />
		</div>
	);
}
