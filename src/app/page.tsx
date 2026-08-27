import { db, dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { FeaturedReview } from "@/components/home/featured-review/featured-review";
import { RecentMoviesSection } from "@/components/home/recent-movies-section/recent-movies-section";
import { RecentlyWatchedSection } from "@/components/home/recently-watched-section/recently-watched-section";
import { AnticipatedReleasesSection } from "@/components/home/anticipated-releases-section/anticipated-releases-section";
import {
	EnrichmentStatus,
	MediaStatus,
	MediaType,
	Prisma,
	UserRole,
} from "@prisma/client";
import styles from "./page.module.sass";

// How many extra reviewed items ride along in FeaturedReview's own picker
// strip, beyond the featured one itself.
const RECENT_REVIEWS_COUNT = 6;
const RECENT_MOVIES_COUNT = 14;
const RECENTLY_WATCHED_COUNT = 14;
const ANTICIPATED_RELEASES_COUNT = 14;
// "Recent movies" is scoped to genuinely recent releases, not just
// whatever's newest on the site — see getRecentMovies.
const RECENT_MOVIES_MONTHS = 5;
// How far out an UPCOMING release can be and still count as "soon" for
// getAnticipatedReleases — keeps that section limited to imminent releases
// rather than anything announced with a distant or unconfirmed date.
const ANTICIPATED_SOON_MONTHS = 2;
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

// Recent releases *you've rated* — not just "what's new on the site"
// (that's RecentMediaListPage's job). A movie/short/show only shows up here
// once it has a rating, same rating: { not: null } condition
// getRecentlyWatchedMovies uses. Scoped to the last RECENT_MOVIES_MONTHS so a
// quiet stretch doesn't dredge up an old release, but never below
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
			review: { rating: { not: null } },
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
			review: { rating: { not: null } },
		},
		include: { movie: true, tvShow: true, review: true },
		orderBy: { releaseDate: "desc" },
		take: MIN_RECENT_MOVIES,
	});
}

// What's on *the site owner's* watchlist that's actually worth anticipating —
// narrowed to media that's either UPCOMING with a confirmed release date
// within ANTICIPATED_SOON_MONTHS (ANNOUNCED titles with no firm date are
// excluded — they aren't "soon") or was released within the same
// RECENT_MOVIES_MONTHS window getRecentMovies uses (i.e. still "in theaters"),
// and that hasn't already been rated (once rated, it belongs in "Recent
// releases" or "Recently watched" instead, not here). Deliberately excludes
// the rest of the watchlist — an old title still waiting to be gotten to
// isn't "anticipated," it's just backlog.
//
// This site is fundamentally one person's library shared publicly — regular
// visitors can sign up (see /signup) to keep their own personal watchlist
// (see /account), but that's a separate, unrelated feature from this
// section: this reads only the ADMIN account's own watchlist, the one used to
// curate the site itself, not an aggregate of every visitor's bookmarks.
//
// Queried from WatchlistItem rather than through dbPublic, so isDeleted has
// to be spelled out by hand here (same as credit-media-list-page.tsx) — and
// since this reads unreleased media on purpose, `status` is filtered
// explicitly rather than going through dbPublic's default exclusion.
async function getAnticipatedReleases() {
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - RECENT_MOVIES_MONTHS);
	const soonCutoff = new Date();
	soonCutoff.setMonth(soonCutoff.getMonth() + ANTICIPATED_SOON_MONTHS);

	const items = await db.watchlistItem.findMany({
		where: {
			user: { role: UserRole.ADMIN },
			media: {
				type: { in: SCREEN_MEDIA_TYPES },
				enrichmentStatus: EnrichmentStatus.DONE,
				isAdult: false,
				isDeleted: false,
				OR: [
					{ status: MediaStatus.UPCOMING, releaseDate: { gte: new Date(), lte: soonCutoff } },
					{ releaseDate: { gte: cutoff } },
				],
				NOT: { review: { rating: { not: null } } },
			},
		},
		include: {
			media: { include: { movie: true, tvShow: true, review: true } },
		},
		orderBy: { media: { releaseDate: { sort: "asc", nulls: "last" } } },
		take: ANTICIPATED_RELEASES_COUNT,
		distinct: ["mediaId"],
	});

	return items.map((item) => item.media);
}

// Movies/shorts/shows that have been watched (a rating exists) but haven't
// been written up yet — the mirror image of getFeaturedReviewItems'
// REVIEWED_WHERE. Ordered by watchedDate (Review.createDate) since there's
// no reviewDate to sort by yet. excludeIds drops anything already surfaced
// in "Recent releases" (see getRecentMovies) — the two sections' filters
// otherwise overlap freely (both are just "screen media with a rating"),
// so without this a just-watched new release would show up twice.
async function getRecentlyWatchedMovies(excludeIds: number[]) {
	const recentlyWatched = await dbPublic.media.findMany({
		where: {
			type: { in: SCREEN_MEDIA_TYPES },
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
			id: { notIn: excludeIds },
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

// Deterministic PRNG (mulberry32) seeded from a string — same seed always
// produces the same sequence, which is what lets the shuffle below be
// "random" yet stable for every request within the same day.
function mulberry32(seed: number) {
	return function random() {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
	}
	return hash;
}

// Fisher-Yates, seeded so the result only changes once the seed itself does
// (see the date-string seed below) rather than on every render.
function seededShuffle<T>(items: T[], seed: string): T[] {
	const random = mulberry32(hashString(seed));
	const shuffled = [...items];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}
	return shuffled;
}

// Featured reviews (admin-curated, see featured-manager-modal.tsx) take
// priority over plain recency in the hero. Two independent queries rather
// than one clever `orderBy` — Prisma can't sort by "is this row featured"
// ahead of a real column, so this fetches the featured set and a generously
// overfetched recent set in parallel, then merges in JS: every featured
// item first (in their own reviewDate order), topped up with recent
// non-featured items to fill out the rest. Overfetching query B (2x) rather
// than sizing it exactly is what keeps this a single round trip each,
// instead of needing query A's ids before deciding how many of B to ask
// for. The merged pool (minus the newest item, pulled out below) is then
// shuffled with a seed derived from today's date (UTC) — same order for
// every visitor/request today, a new order tomorrow — so the picker strip
// rotates daily instead of reshuffling on every reload.
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
	const merged = [
		...featured,
		...recent.filter((m) => !featuredIds.has(m.id)),
	].slice(0, take);

	// A brand-new review always opens the hero (items[0]) regardless of the
	// shuffle below — it's pulled out here by the same reviewDate/createDate
	// recency used to order the queries above, then re-prepended after the
	// rest of the pool is shuffled, so only the picker strip behind it
	// rotates day to day.
	const [newest, ...rest] = [...merged].sort((a, b) =>
		compareReviewRecency(a, b),
	);
	if (!newest) return merged;

	const todaySeed = new Date().toISOString().slice(0, 10);
	return [newest, ...seededShuffle(rest, todaySeed)];
}

// Same precedence as REVIEWED_ORDER_BY (reviewDate desc, nulls last, then
// createDate desc) but as a comparator so the merged pool — already only
// piecewise sorted by the two queries above — can be re-sorted as one list
// to find its single most-recent item.
function compareReviewRecency(
	a: { review: { reviewDate: Date | null; createDate: Date } | null },
	b: { review: { reviewDate: Date | null; createDate: Date } | null },
): number {
	const aDate = a.review?.reviewDate;
	const bDate = b.review?.reviewDate;
	if (aDate && bDate) return bDate.getTime() - aDate.getTime();
	if (aDate) return -1;
	if (bDate) return 1;
	return b.review!.createDate.getTime() - a.review!.createDate.getTime();
}

export default async function HomePage() {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts. recentMoviesRaw has to resolve before
	// getRecentlyWatchedMovies can run (it excludes those ids), so it's
	// pulled out of the Promise.all below; the rest still don't depend on
	// each other.
	const [reviewed, recentMoviesRaw, anticipatedRaw] = await Promise.all([
		getFeaturedReviewItems(),
		getRecentMovies(),
		getAnticipatedReleases(),
	]);
	const recentlyWatchedRaw = await getRecentlyWatchedMovies(
		recentMoviesRaw.map((m) => m.id),
	);

	const reviewedList = reviewed.map(toMediaRecord);
	const recentMovies = recentMoviesRaw.map(toMediaRecord);
	const recentlyWatched = recentlyWatchedRaw.map(toMediaRecord);
	const anticipatedReleases = anticipatedRaw.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<FeaturedReview items={reviewedList} />
			<RecentMoviesSection items={recentMovies} />
			<AnticipatedReleasesSection items={anticipatedReleases} />
			<RecentlyWatchedSection items={recentlyWatched} />
		</div>
	);
}
