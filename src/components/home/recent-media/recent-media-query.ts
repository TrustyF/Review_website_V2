import { dbPublic } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { RECENT_MEDIA_GROUPS, RecentMediaGroup } from "./recent-media-groups";

// Shared by non-screen home sections (books/comics/games/manga). Fixed-size curated lists like movie sections, not paginated feed.
const RECENT_COUNT = 14;

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

// Recent items across the group's types (by rating date); excludeIds avoids repeating "Recent releases"
async function getRecentlyWatched(
	types: readonly MediaType[],
	excludeIds: number[],
): Promise<MediaRecord[]> {
	const raw = await dbPublic.media.findMany({
		where: {
			type: { in: [...types] },
			enrichmentStatus: EnrichmentStatus.DONE,
			isAdult: false,
			...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
			review: {
				rating: { not: null },
				createDate: { gte: monthsAgo(RECENT_MONTHS) },
			},
		},
		include: EVERY_TYPE_RELATION,
		orderBy: { review: { createDate: "desc" } },
		take: RECENT_COUNT,
	});
	return raw.map(toMediaRecord);
}

export type RecentMediaSectionData = {
	// One row per type that has any, in group order.
	recentReleases: { type: MediaType; items: MediaRecord[] }[];
	recentlyWatched: MediaRecord[];
};

// Comics don't get a "Recent releases" section — release dates for tracked issues aren't a
// meaningful "new" signal here. Games only show "Recently played".
const SKIP_RECENT_RELEASES: MediaType[] = [MediaType.COMIC, MediaType.GAME];

export async function loadRecentMediaSection(
	group: RecentMediaGroup,
): Promise<RecentMediaSectionData> {
	const types = RECENT_MEDIA_GROUPS[group];
	const releaseRows = await Promise.all(
		types
			.filter((type) => !SKIP_RECENT_RELEASES.includes(type))
			.map(async (type) => ({ type, items: await getRecentReleases(type) })),
	);
	const recentReleases = releaseRows.filter((row) => row.items.length > 0);
	const recentlyWatched = await getRecentlyWatched(
		types,
		recentReleases.flatMap((row) => row.items.map((m) => m.id)),
	);
	return { recentReleases, recentlyWatched };
}
