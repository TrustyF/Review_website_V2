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

export type CountryStat = {
	code: string;
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
	// The scope this data was computed for — null is "All". `years` is always
	// unscoped, so the selector never changes shape as the user switches years.
	year: number | null;
	years: number[];
	totals: {
		titles: number;
		rated: number;
		reviewsWritten: number;
		avgRating: number | null;
		movieMinutesWatched: number;
	};
	byType: { type: MediaType; count: number }[];
	topGenres: { name: string; count: number }[];
	topCountries: CountryStat[];
	worldMap: CountryStat[];
	topPeople: Record<PersonRole, PersonRanking>;
	ratingHistogram: { counts: number[]; unrated: number };
	reviewsByYear: { year: number; count: number }[];
	mediaByDecade: { decade: number; count: number }[];
};
