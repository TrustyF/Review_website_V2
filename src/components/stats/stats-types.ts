import type { MediaType } from "@prisma/client";

// Fixed slot order for the media-type breakdown's categorical palette —
// color always follows this order, never the data's own rank.
export const MEDIA_TYPE_ORDER: MediaType[] = [
	"MOVIE",
	"SHORT",
	"TVSHOW",
	"MANGA",
	"COMIC",
	"GAME",
	"BOOK",
];

// Maps each MediaType to its key in dict.nav.search.typeLabels — shared by
// the media-type breakdown chart and the stats page's own type filter.
export const MEDIA_TYPE_LABEL_KEY: Record<
	MediaType,
	"movie" | "short" | "tvShow" | "manga" | "comic" | "game" | "book"
> = {
	MOVIE: "movie",
	SHORT: "short",
	TVSHOW: "tvShow",
	MANGA: "manga",
	COMIC: "comic",
	GAME: "game",
	BOOK: "book",
};

export type CountryStat = {
	code: string;
	name: string;
	count: number;
	avgRating: number | null;
};

export type GenreStat = {
	name: string;
	count: number;
	avgRating: number | null;
};

export type PersonStat = {
	id: number;
	name: string;
	photoSrc: string | null;
	count: number;
	avgRating: number | null;
};

export type PersonRole = "ACTOR" | "DIRECTOR";

// Credit.role names per leaderboard group — MOVIE/TVSHOW terminology only.
export const PERSON_ROLE_NAMES: Record<PersonRole, string[]> = {
	ACTOR: ["Actor"],
	DIRECTOR: ["Director"],
};

export type PersonRanking = { byTitles: PersonStat[]; byRating: PersonStat[] };

export type StatsData = {
	// The scope this data was computed for — null is "All" for either. `years`
	// is always unscoped, so the selector never changes shape as the user switches.
	year: number | null;
	years: number[];
	type: MediaType | null;
	totals: {
		titles: number;
		rated: number;
		reviewsWritten: number;
		avgRating: number | null;
		movieMinutesWatched: number;
	};
	byType: { type: MediaType; count: number; avgRating: number | null }[];
	topGenres: GenreStat[];
	topCountries: CountryStat[];
	worldMap: CountryStat[];
	topPeople: Record<PersonRole, PersonRanking>;
	ratingHistogram: { counts: number[]; unrated: number };
	reviewsByYear: { year: number; count: number }[];
	mediaByDecade: { decade: number; count: number }[];
};
