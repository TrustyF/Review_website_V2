import { db, dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { FeaturedReview } from "@/components/home/featured-review/featured-review";
import { RecentMoviesSection } from "@/components/home/recent-movies-section/recent-movies-section";
import { RecentlyWatchedSection } from "@/components/home/recently-watched-section/recently-watched-section";
import { AnticipatedReleasesSection } from "@/components/home/anticipated-releases-section/anticipated-releases-section";
import { LazyRecentMediaSection } from "@/components/home/recent-media/lazy-recent-media-section";
import {
	EnrichmentStatus,
	MediaStatus,
	MediaType,
	Prisma,
	UserRole,
} from "@prisma/client";
import styles from "./page.module.sass";

// Extra reviewed items in FeaturedReview's picker strip, beyond the featured one itself.
const RECENT_REVIEWS_COUNT = 6;
const RECENT_MOVIES_COUNT = 14;
const RECENTLY_WATCHED_COUNT = 14;
const ANTICIPATED_RELEASES_COUNT = 14;
// How far back "recent" reaches for getRecentMovies.
const RECENT_MOVIES_MONTHS = 5;
// How far out an UPCOMING release can be and still count as "soon" for getAnticipatedReleases.
const ANTICIPATED_SOON_MONTHS = 2;
// Floor below which the date filter is dropped, so the section doesn't look sparse after a quiet stretch.
const MIN_RECENT_MOVIES = 7;

// Every type-specific relation toMediaRecord might need — the reviewed feed spans all media types.
const EVERY_TYPE_RELATION = {
	movie: true,
	tvShow: true,
	manga: true,
	comic: true,
	game: true,
	book: true,
} as const;

// Screen releases only — these home sections cover movies/shorts/TV, not the full catalog.
const SCREEN_MEDIA_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
];

// The other home sections, one recent-releases/recently-watched pair per type — each is lazily
// fetched client-side (LazyRecentMediaSection) once it scrolls near the viewport, rather than
// queried up front here alongside the movie sections above.
const OTHER_MEDIA_TYPES: MediaType[] = [
	MediaType.BOOK,
	MediaType.COMIC,
	MediaType.GAME,
	MediaType.MANGA,
];

// Recent releases *you've rated* — not just "what's new" (that's RecentMediaListPage's job). Scoped to RECENT_MOVIES_MONTHS, but the date filter drops entirely below MIN_RECENT_MOVIES rather than showing a half-empty section.
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

// What's on the ADMIN account's watchlist (not an aggregate of visitor watchlists) that's worth anticipating: UPCOMING with a confirmed date within ANTICIPATED_SOON_MONTHS, or released within RECENT_MOVIES_MONTHS ("in theaters"), and not yet rated. Excludes older backlog.
// Queried from WatchlistItem, not dbPublic, so isDeleted/status are filtered explicitly here since this deliberately includes unreleased media.
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

// Watched (rated) but not yet written up — mirror of getFeaturedReviewItems' REVIEWED_WHERE. excludeIds prevents overlap with "Recent releases", since both are otherwise just "screen media with a rating".
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

// Shared by both queries below so featured vs. recent are only ever distinguished by the `featured` condition.
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

// Deterministic PRNG (mulberry32) — same seed always produces the same sequence, so the shuffle below is stable within a day.
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

// Fisher-Yates, seeded so the result only changes when the seed does, not on every render.
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
			{OTHER_MEDIA_TYPES.map((type) => (
				<LazyRecentMediaSection key={type} type={type} />
			))}
		</div>
	);
}
