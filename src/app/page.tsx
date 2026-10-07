import { Suspense } from "react";
import { auth } from "@/auth";
import { db, dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { FeaturedReview } from "@/components/home/featured-review/featured-review";
import { RecentMoviesSection } from "@/components/home/recent-movies-section/recent-movies-section";
import { RecentlyWatchedSection } from "@/components/home/recently-watched-section/recently-watched-section";
import { MyWatchlistSection } from "@/components/home/my-watchlist-section/my-watchlist-section";
import { AnticipatedReleasesSection } from "@/components/home/anticipated-releases-section/anticipated-releases-section";
import { LazyRecentMediaSection } from "@/components/home/recent-media/lazy-recent-media-section";
import {
	RECENT_MEDIA_GROUPS,
	type RecentMediaGroup,
} from "@/components/home/recent-media/recent-media-groups";
import { YourWatchlistSection } from "@/components/home/your-watchlist-section/your-watchlist-section";
import { ActivitySection } from "@/components/home/activity-section/activity-section";
import { FeaturedListsSection } from "@/components/home/featured-lists-section/featured-lists-section";
import { RecommendationCta } from "@/components/home/recommendation-cta/recommendation-cta";
import { RandomPickSection } from "@/components/home/random-pick/random-pick-section";
import { MovieSpotlightSection } from "@/components/home/movie-spotlight-section/movie-spotlight-section";
import { HomeReveal } from "@/components/home/reveal/home-reveal";
import { PersonSpotlightSection } from "@/components/home/person-spotlight-section/person-spotlight-section";
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
const MY_WATCHLIST_COUNT = 7;
const ANTICIPATED_RELEASES_COUNT = 14;
// How far back "recent" reaches for getRecentMovies.
const RECENT_MOVIES_MONTHS = 2;
// How far back an already-released title still counts as "in theaters" for getAnticipatedReleases.
const ANTICIPATED_RELEASED_WEEKS = 3;
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
const RECENT_MEDIA_GROUP_KEYS = Object.keys(
	RECENT_MEDIA_GROUPS,
) as RecentMediaGroup[];

const SCREEN_MEDIA_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
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

// What's on the ADMIN account's watchlist (not an aggregate of visitor watchlists) that's worth anticipating: UPCOMING with a confirmed date within ANTICIPATED_SOON_MONTHS, or released within ANTICIPATED_RELEASED_WEEKS ("in theaters"), and not yet rated. Excludes older backlog.
// Queried from WatchlistItem, not dbPublic, so isDeleted/status are filtered explicitly here since this deliberately includes unreleased media.
async function getAnticipatedReleases() {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - ANTICIPATED_RELEASED_WEEKS * 7);
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
					{
						status: MediaStatus.UPCOMING,
						releaseDate: { gte: new Date(), lte: soonCutoff },
					},
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

// The ADMIN account's watchlist (not the visitor's) — same "whose watchlist" convention as getAnticipatedReleases, just without that function's release-date/unrated filtering. Newest-added first. excludeIds drops anything already shown in "Anticipated releases".
async function getMyWatchlist(excludeIds: number[]) {
	const items = await db.watchlistItem.findMany({
		where: {
			user: { role: UserRole.ADMIN },
			mediaId: { notIn: excludeIds },
			media: { isDeleted: false },
		},
		include: { media: { include: { ...EVERY_TYPE_RELATION, review: true } } },
		orderBy: { addedAt: "desc" },
		take: MY_WATCHLIST_COUNT,
	});

	return items.map((item) => item.media);
}

// Shared by both queries below so featured vs. recent are only ever distinguished by the `featured` condition.
const REVIEWED_REVIEW_WHERE: Prisma.ReviewWhereInput = {
	AND: [{ body: { not: null } }, { body: { not: "" } }],
};
// Book/comic/manga never get bannerPath; hero card looks bare. Excluded here so banner-less review doesn't consume featured slot.
const NO_BANNER_MEDIA_TYPES: MediaType[] = [
	MediaType.BOOK,
	MediaType.COMIC,
	MediaType.MANGA,
];
const REVIEWED_WHERE: Prisma.MediaWhereInput = {
	enrichmentStatus: EnrichmentStatus.DONE,
	isAdult: false,
	type: { notIn: NO_BANNER_MEDIA_TYPES },
	review: REVIEWED_REVIEW_WHERE,
};
const REVIEWED_ORDER_BY: Prisma.MediaOrderByWithRelationInput[] = [
	{ review: { reviewDate: { sort: "desc", nulls: "last" } } },
	{ review: { createDate: "desc" } },
];

// Featured first, then recent non-featured (2x-overfetched); merged then sorted newest review first.
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

	return merged.sort(compareReviewRecency);
}

// Comparator to re-sort merged pool with same precedence as REVIEWED_ORDER_BY
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

// Streamed rows below the fold — each awaits only what it needs, so none of them hold up the first paint.
async function AnticipatedRow({
	anticipated,
}: {
	anticipated: Promise<AnticipatedMedia[]>;
}) {
	return (
		<AnticipatedReleasesSection
			items={(await anticipated).map(toMediaRecord)}
		/>
	);
}

// Waits on recentMovies (already resolved by the time this renders) only for its exclude list.
async function RecentlyWatchedRow({
	recentMovies,
}: {
	recentMovies: Promise<{ id: number }[]>;
}) {
	const excludeIds = (await recentMovies).map((m) => m.id);
	const raw = await getRecentlyWatchedMovies(excludeIds);
	return <RecentlyWatchedSection items={raw.map(toMediaRecord)} />;
}

async function MyWatchlistRow({
	anticipated,
}: {
	anticipated: Promise<AnticipatedMedia[]>;
}) {
	const excludeIds = (await anticipated).map((m) => m.id);
	const raw = await getMyWatchlist(excludeIds);
	return <MyWatchlistSection items={raw.map(toMediaRecord)} />;
}

type AnticipatedMedia = Awaited<
	ReturnType<typeof getAnticipatedReleases>
>[number];

export default async function HomePage() {
	// dbPublic excludes soft-deleted media. Only the hero and Recent releases block the first paint;
	// anticipated starts now but is awaited inside its own (and the watchlist's) Suspense boundary.
	const recentMoviesPromise = getRecentMovies();
	const anticipatedPromise = getAnticipatedReleases();
	const [reviewed, recentMoviesRaw, session] = await Promise.all([
		getFeaturedReviewItems(),
		recentMoviesPromise,
		auth(),
	]);
	const userId = session?.user?.id;
	const isAdmin = session?.user?.role === UserRole.ADMIN;

	const reviewedList = reviewed.map(toMediaRecord);
	const recentMovies = recentMoviesRaw.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<FeaturedReview items={reviewedList} />
			<HomeReveal>
				<RecentMoviesSection items={recentMovies} />
				{/* The admin's own watchlist already shows as MyWatchlistSection. */}
				{userId && !isAdmin && (
					<Suspense>
						<YourWatchlistSection userId={userId} />
					</Suspense>
				)}
				<Suspense>
					<AnticipatedRow anticipated={anticipatedPromise} />
				</Suspense>
				<Suspense>
					<RecentlyWatchedRow recentMovies={recentMoviesPromise} />
				</Suspense>
				<Suspense>
					<FeaturedListsSection />
				</Suspense>
				<Suspense>
					<RandomPickSection />
				</Suspense>
				<Suspense>
					<MovieSpotlightSection />
				</Suspense>
				<Suspense>
					<PersonSpotlightSection />
				</Suspense>
				{/* Lazily fetched client-side on scroll. */}
				{RECENT_MEDIA_GROUP_KEYS.map((group) => (
					<LazyRecentMediaSection key={group} group={group} />
				))}
				<Suspense>
					<MyWatchlistRow anticipated={anticipatedPromise} />
				</Suspense>
				{/* Admins get no CTA, so the activity preview takes the full width. */}
				{isAdmin ? (
					<Suspense>
						<ActivitySection />
					</Suspense>
				) : (
					<div className={styles.split}>
						<Suspense>
							<ActivitySection />
						</Suspense>
						<aside className={styles.side}>
							<RecommendationCta signedIn={Boolean(userId)} />
						</aside>
					</div>
				)}
			</HomeReveal>
		</div>
	);
}
