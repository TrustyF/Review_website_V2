import { dbPublic } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { EnrichmentStatus, MediaType } from "@prisma/client";

// Shared by every non-screen home section (books/comics/games/manga) added alongside the
// movie-specific ones in src/app/page.tsx, which keep their own bespoke query logic.
// Fixed-size like the movie sections — these are curated lists, not a paginated feed.
export const RECENT_COUNT = 14;

// Every type-specific relation toMediaRecord might need. Simpler to always include all of them
// (the query is scoped to a single `type` anyway, so the others just come back null) than to
// type a per-type include map, which loses the literal narrowing Prisma needs to infer the result shape.
const EVERY_TYPE_RELATION = {
	movie: true,
	tvShow: true,
	manga: true,
	comic: true,
	game: true,
	book: true,
	review: true,
} as const;

// How far back "recent" reaches — same window as movies' RECENT_MOVIES_MONTHS in page.tsx.
const RECENT_MONTHS = 5;
// Floor below which the date filter is dropped, so the section doesn't look sparse after a
// quiet stretch — same MIN_RECENT_MOVIES fallback as getRecentMovies in page.tsx.
const MIN_RECENT = 7;

function monthsAgo(months: number): Date {
	const date = new Date();
	date.setMonth(date.getMonth() - months);
	return date;
}

// Recent releases *you've rated*, newest release first, within the last RECENT_MONTHS — falling
// back to an unfiltered (but still rated) list if that cutoff leaves fewer than MIN_RECENT, unless
// it leaves none at all, in which case the whole catalog predates the cutoff and the section
// should just be hidden (see loadRecentMediaSection) rather than padded out with old items.
async function getRecentReleases(type: MediaType): Promise<MediaRecord[]> {
	const cutoff = monthsAgo(RECENT_MONTHS);

	const recent = await dbPublic.media.findMany({
		where: {
			type,
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
			releaseDate: { gte: cutoff },
			review: { rating: { not: null } },
		},
		include: EVERY_TYPE_RELATION,
		orderBy: { releaseDate: "desc" },
		take: RECENT_COUNT,
	});
	if (recent.length >= MIN_RECENT || recent.length === 0) {
		return recent.map(toMediaRecord);
	}

	const fallback = await dbPublic.media.findMany({
		where: {
			type,
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
			releaseDate: { not: null },
			review: { rating: { not: null } },
		},
		include: EVERY_TYPE_RELATION,
		orderBy: { releaseDate: "desc" },
		take: MIN_RECENT,
	});
	return fallback.map(toMediaRecord);
}

// Watched/read/played (rated) within the last RECENT_MONTHS, most recently rated first.
// excludeIds keeps this list from repeating what "Recent releases" just showed — mirrors
// getRecentlyWatchedMovies in page.tsx.
async function getRecentlyWatched(
	type: MediaType,
	excludeIds: number[],
	take: number,
): Promise<MediaRecord[]> {
	const raw = await dbPublic.media.findMany({
		where: {
			type,
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
			...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
			review: { rating: { not: null }, createDate: { gte: monthsAgo(RECENT_MONTHS) } },
		},
		include: EVERY_TYPE_RELATION,
		orderBy: { review: { createDate: "desc" } },
		take,
	});
	return raw.map(toMediaRecord);
}

export type RecentMediaSectionData = {
	recentReleases: MediaRecord[];
	recentlyWatched: MediaRecord[];
};

// Comics don't get a "Recent releases" section — release dates for tracked issues aren't a
// meaningful "new" signal here, unlike movies/books/games/manga.
const SKIP_RECENT_RELEASES: MediaType[] = [MediaType.COMIC];

// "Recently read" (books/comics/manga) shows fewer than "Recently watched"/"Recently played".
const RECENTLY_READ_COUNT = 7;
const RECENTLY_READ_TYPES: MediaType[] = [
	MediaType.BOOK,
	MediaType.COMIC,
	MediaType.MANGA,
];

export async function loadRecentMediaSection(
	type: MediaType,
): Promise<RecentMediaSectionData> {
	const recentReleases = SKIP_RECENT_RELEASES.includes(type)
		? []
		: await getRecentReleases(type);
	const recentlyWatched = await getRecentlyWatched(
		type,
		recentReleases.map((m) => m.id),
		RECENTLY_READ_TYPES.includes(type) ? RECENTLY_READ_COUNT : RECENT_COUNT,
	);
	return { recentReleases, recentlyWatched };
}
