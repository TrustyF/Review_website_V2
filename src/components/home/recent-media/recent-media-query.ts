import { dbPublic } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { EnrichmentStatus, MediaType } from "@prisma/client";

// Shared by non-screen home sections (books/comics/games/manga). Fixed-size curated lists like movie sections, not paginated feed.
export const RECENT_COUNT = 14;

// All type-specific relations (others null for scoped query).
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

// Recent releases you've rated, fallback to unfiltered if below MIN_RECENT, hidden if none.
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

// Recent items (by rating date); excludeIds avoids repeating "Recent releases"
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
