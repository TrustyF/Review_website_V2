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

// Animation/Family are format/audience tags, not genre info; the rest sit
// on 25-35% of the catalog — too broad to be distinctive in the ranking.
export const BROAD_GENRES = new Set([
	"Animation",
	"Family",
	"Adventure",
	"Comedy",
	"Drama",
	"Action",
	"Fantasy",
	"Thriller",
]);

export type CountryStat = {
	code: string;
	name: string;
	count: number;
	avgRating: number | null;
};

type GenreStat = {
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

// People per role and ranking on the stats page.
export const TOP_PEOPLE_COUNT = 12;

export const RUNTIME_BAND_MINUTES = 15;
// Runtimes outside this range fold into the first/last band.
export const RUNTIME_MIN = 60;
export const RUNTIME_MAX = 180;

// One point on a me-vs-public line, averaging ratings on my 0–10 scale over the
// bin and its neighbours. Null when the bin itself is too thin, drawn as a gap.
export type ComparisonBin = {
	key: number;
	myAvg: number | null;
	publicAvg: number | null;
};

export type ScatterPoint = {
	my: number;
	public: number;
	mediaId: number;
	title: string;
	titleFr: string | null;
};

// One step on a time line; null when that step is too thin, drawn as a gap.
export type TimeBin = { key: number; value: number | null };

export type StatsData = {
	// The scope this data was computed for — null is "All" for either. `years`
	// is always unscoped, so the selector never changes shape as the user switches.
	year: number | null;
	years: number[];
	type: MediaType | null;
	totals: {
		titles: number;
		longestStreakDays: number;
		reviewsWritten: number;
		avgRating: number | null;
		movieMinutesWatched: number;
	};
	byType: { type: MediaType; count: number; avgRating: number | null }[];
	topGenres: GenreStat[];
	topCountries: CountryStat[];
	worldMap: CountryStat[];
	topPeople: Record<PersonRole, PersonRanking>;
	// Same one type as vsPublic; publicCounts buckets those titles by Media.publicRating.
	ratingHistogram: {
		counts: number[];
		publicCounts: number[];
		unrated: number;
	};
	// One type (the picked one, or movies for "All"), and only titles with both
	// my rating and a public one.
	vsPublic: {
		type: MediaType;
		byDecade: ComparisonBin[];
		// Full history like reviewsByYear, ignores the year scope.
		byReviewYear: ComparisonBin[];
		// Movies only; key is the band's start in minutes.
		byRuntime: ComparisonBin[];
		// Movies + TV; key is the popularity fifth, 0 = least popular.
		byPopularity: ComparisonBin[];
		points: ScatterPoint[];
	};
	// Full history (type-scoped) except the calendar, which follows the year.
	timeline: {
		// start is a UTC YYYY-MM-DD; counts holds one entry per day from there.
		// titles holds each day's logged titles, parallel to counts.
		calendar: {
			start: string;
			counts: number[];
			titles: { title: string; titleFr: string | null }[][];
		};
		// Keys are year * 4 + quarter (thin quarters skipped); name null is
		// "Other"; each key's shares sum to 1.
		genreShift: {
			keys: number[];
			series: { name: string | null; shares: number[] }[];
		};
		// Fractional years.
		age: {
			watched: number;
			released: number;
			mediaId: number;
			title: string;
			titleFr: string | null;
		}[];
		// Keys are year * 4 + quarter.
		ratingByQuarter: TimeBin[];
	};
	reviewsByYear: { year: number; count: number }[];
	mediaByDecade: { decade: number; count: number }[];
};
