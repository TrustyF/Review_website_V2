import { dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { FeaturedReview } from "@/components/home/featured-review/featured-review";
import { RecentMoviesSection } from "@/components/home/recent-movies-section/recent-movies-section";
import { RecentlyWatchedSection } from "@/components/home/recently-watched-section/recently-watched-section";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import styles from "./page.module.sass";

// How many extra reviewed items ride along in FeaturedReview's own picker
// strip, beyond the featured one itself.
const RECENT_REVIEWS_COUNT = 6;
const RECENT_MOVIES_COUNT = 14;
const RECENTLY_WATCHED_COUNT = 14;
// "Recent movies" is scoped to genuinely recent releases, not just
// whatever's newest on the site — see getRecentMovies.
const RECENT_MOVIES_MONTHS = 5;
// Floor so the section never looks sparse right after a quiet stretch —
// if fewer than this many releases fall inside the window, the date
// filter is dropped entirely (see getRecentMovies).
const MIN_RECENT_MOVIES = 7;

// Every type-specific relation toMediaRecord might need — the reviewed feed
// spans every media type, unlike RecentMoviesSection's own query below
// which only ever needs `movie`/`tvShow`.
const EVERY_TYPE_RELATION = {
	movie: true,
	tvShow: true,
	manga: true,
	comic: true,
	game: true,
	book: true,
} as const;

// Screen releases only — the "Recent releases" and "Recently watched" home
// sections cover movies, shorts, and TV shows, not the full catalog.
const SCREEN_MEDIA_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
];

// "What's new on the site" (by releaseDate, same as RecentMediaListPage),
// not "what was reviewed most recently" — a movie/short/show can appear here
// whether or not it has a review yet. Scoped to the last RECENT_MOVIES_MONTHS
// so a quiet stretch doesn't dredge up an old release, but never below
// MIN_RECENT_MOVIES — if the window doesn't have enough, the date filter is
// dropped entirely rather than showing a half-empty section.
async function getRecentMovies() {
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - RECENT_MOVIES_MONTHS);

	const recent = await dbPublic.media.findMany({
		where: {
			type: { in: SCREEN_MEDIA_TYPES },
			enrichmentStatus: EnrichmentStatus.DONE,
			releaseDate: { gte: cutoff },
			isAdult: false,
		},
		include: { movie: true, tvShow: true, review: true },
		orderBy: { releaseDate: "desc" },
		take: RECENT_MOVIES_COUNT,
	});
	if (recent.length >= MIN_RECENT_MOVIES) return recent;

	return dbPublic.media.findMany({
		where: {
			type: { in: SCREEN_MEDIA_TYPES },
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
		},
		include: { movie: true, tvShow: true, review: true },
		orderBy: { releaseDate: "desc" },
		take: MIN_RECENT_MOVIES,
	});
}

// Movies/shorts/shows that have been watched (a rating exists) but haven't
// been written up yet — the mirror image of getFeaturedReviewItems'
// REVIEWED_WHERE. Ordered by watchedDate (Review.createDate) since there's
// no reviewDate to sort by yet.
async function getRecentlyWatchedMovies() {
	const recentlyWatched = await dbPublic.media.findMany({
		where: {
			type: { in: SCREEN_MEDIA_TYPES },
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
			review: {
				rating: { not: null },
				// OR: [{ body: null }, { body: "" }],
			},
		},
		include: { movie: true, tvShow: true, review: true },
		orderBy: { review: { createDate: "desc" } },
		take: RECENTLY_WATCHED_COUNT,
	});
	return recentlyWatched;
}

// Same reviewed-body/DONE filter and reviewDate/createDate ordering as
// before, shared by both queries below so a featured item and a plain
// recent one are only ever distinguished by the `featured` condition, never
// by drifting out of sync on anything else.
const REVIEWED_REVIEW_WHERE: Prisma.ReviewWhereInput = {
	AND: [{ body: { not: null } }, { body: { not: "" } }],
};
const REVIEWED_WHERE: Prisma.MediaWhereInput = {
	enrichmentStatus: EnrichmentStatus.DONE,
	isAdult: false,
	review: REVIEWED_REVIEW_WHERE,
};
const REVIEWED_ORDER_BY: Prisma.MediaOrderByWithRelationInput[] = [
	{ review: { reviewDate: { sort: "desc", nulls: "last" } } },
	{ review: { createDate: "desc" } },
];

// Featured reviews (admin-curated, see featured-manager-modal.tsx) take
// priority over plain recency in the hero. Two independent queries rather
// than one clever `orderBy` — Prisma can't sort by "is this row featured"
// ahead of a real column, so this fetches the featured set and a generously
// overfetched recent set in parallel, then merges in JS: every featured
// item first (in their own reviewDate order), topped up with recent
// non-featured items to fill out the rest. Overfetching query B (2x) rather
// than sizing it exactly is what keeps this a single round trip each,
// instead of needing query A's ids before deciding how many of B to ask
// for.
async function getFeaturedReviewItems() {
	const take = 1 + RECENT_REVIEWS_COUNT;
	const [featured, recent] = await Promise.all([
		dbPublic.media.findMany({
			where: {
				...REVIEWED_WHERE,
				review: { ...REVIEWED_REVIEW_WHERE, featured: true },
			},
			include: { ...EVERY_TYPE_RELATION, review: true },
			orderBy: REVIEWED_ORDER_BY,
			take,
		}),
		dbPublic.media.findMany({
			where: REVIEWED_WHERE,
			include: { ...EVERY_TYPE_RELATION, review: true },
			orderBy: REVIEWED_ORDER_BY,
			take: take * 2,
		}),
	]);

	const featuredIds = new Set(featured.map((m) => m.id));
	return [...featured, ...recent.filter((m) => !featuredIds.has(m.id))].slice(
		0,
		take,
	);
}

export default async function HomePage() {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts. The two queries don't depend on each other, so
	// there's no reason to make one wait on the other.
	const [reviewed, recentMoviesRaw, recentlyWatchedRaw] = await Promise.all([
		getFeaturedReviewItems(),
		getRecentMovies(),
		getRecentlyWatchedMovies(),
	]);

	const reviewedList = reviewed.map(toMediaRecord);
	const recentMovies = recentMoviesRaw.map(toMediaRecord);
	const recentlyWatched = recentlyWatchedRaw.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<FeaturedReview items={reviewedList} />
			<RecentMoviesSection items={recentMovies} />
			<RecentlyWatchedSection items={recentlyWatched} />
		</div>
	);
}
