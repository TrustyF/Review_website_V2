"use server";
import { db } from "@/server/db/client";
import { MediaStatus, MediaType, type Prisma } from "@prisma/client";
import { WORLD_MAP_COUNTRIES } from "@/components/stats/world-map/world-map-paths.generated";
import { toPersonPhotoSrc } from "@/server/resolvers/asset-paths";
import {
	MEDIA_TYPE_ORDER,
	PERSON_ROLE_NAMES,
	type PersonRole,
	type PersonStat,
	type StatsData,
} from "@/components/stats/stats-types";

// Same public-facing shape as dbPublic, applied by hand — dbPublic only
// patches findMany/findFirst/findUnique/count, not groupBy/aggregate.
const MEDIA_FILTER = {
	isDeleted: false,
	isAdult: false,
	status: { notIn: [MediaStatus.ANNOUNCED, MediaStatus.UPCOMING] },
} satisfies Prisma.MediaWhereInput;

const RATING_TIER_COUNT = 10;
// Same reasoning as the world map's own MIN_SAMPLE_FOR_RATING — a person with
// one or two credits shouldn't be able to top the avg-rating leaderboard.
const MIN_SAMPLE_FOR_PERSON_RATING = 3;
const TOP_PEOPLE_COUNT = 12;
// Top-10-billed only — cuts off cameos/bit parts (Stan Lee's Marvel cameos
// all land at order 18+, median 35) that shouldn't dominate the ranking.
const TOP_BILLING_CUTOFF = 10;

const COUNTRY_NAME_BY_CODE = new Map(
	WORLD_MAP_COUNTRIES.map((c) => [c.code, c.name]),
);

// Jan 1 (inclusive) to Jan 1 next year (exclusive), UTC — undefined for "All".
function reviewYearRange(
	year: number | null,
): Prisma.DateTimeFilter | undefined {
	if (year == null) return undefined;
	return {
		gte: new Date(Date.UTC(year, 0, 1)),
		lt: new Date(Date.UTC(year + 1, 0, 1)),
	};
}

// "All" (type: null) matches today's catalog-wide filter; a specific type
// narrows every query down to just that MediaType.
function mediaFilterWithType(type: MediaType | null): Prisma.MediaWhereInput {
	return type ? { ...MEDIA_FILTER, type } : MEDIA_FILTER;
}

// Combines both scopes — "All"/"All" matches today's catalog-wide behavior;
// a specific year narrows to media actually reviewed/watched that year.
function reviewedMediaFilter(
	year: number | null,
	type: MediaType | null,
): Prisma.MediaWhereInput {
	const range = reviewYearRange(year);
	const base = mediaFilterWithType(type);
	return range ? { ...base, review: { createDate: range } } : base;
}

export async function getStats(
	year: number | null = null,
	type: MediaType | null = null,
): Promise<StatsData> {
	const range = reviewYearRange(year);
	const mediaFilter = reviewedMediaFilter(year, type);
	const reviewMediaFilter = mediaFilterWithType(type);

	const [
		titles,
		reviewsWritten,
		avgRatingResult,
		movieRuntimeResult,
		typeMediaRows,
		countryMediaRows,
		countries,
		genreMediaRows,
		genres,
		reviewRatings,
		allReviewDates,
		mediaReleaseDates,
		personCredits,
	] = await Promise.all([
		db.media.count({ where: mediaFilter }),
		db.review.count({
			where: {
				media: reviewMediaFilter,
				body: { not: null },
				...(range ? { createDate: range } : {}),
			},
		}),
		db.review.aggregate({
			where: {
				media: reviewMediaFilter,
				...(range ? { createDate: range } : {}),
			},
			_avg: { rating: true },
		}),
		db.movie.aggregate({
			where: { media: mediaFilter },
			_sum: { runtime: true },
		}),
		db.media.findMany({
			where: mediaFilter,
			select: { type: true, review: { select: { rating: true } } },
		}),
		db.media.findMany({
			where: { ...mediaFilter, countryId: { not: null } },
			select: { countryId: true, review: { select: { rating: true } } },
		}),
		db.country.findMany({ select: { id: true, countryCode2: true } }),
		db.mediaGenre.findMany({
			where: { media: mediaFilter },
			select: {
				mediaId: true,
				genreId: true,
				media: { select: { review: { select: { rating: true } } } },
			},
			orderBy: { genreId: "asc" },
		}),
		db.genre.findMany({ select: { id: true, name: true } }),
		db.review.findMany({
			where: {
				media: reviewMediaFilter,
				...(range ? { createDate: range } : {}),
			},
			select: { rating: true, createDate: true },
		}),
		// Always unscoped by year (drives the year selector + the "Reviews per
		// year" chart, which stays full-history) but still respects the type filter.
		db.review.findMany({
			where: { media: reviewMediaFilter },
			select: { createDate: true },
		}),
		db.media.findMany({
			where: { ...mediaFilter, releaseDate: { not: null } },
			select: { releaseDate: true },
		}),
		db.credit.findMany({
			where: {
				personId: { not: null },
				// Top People is movie-only. NOT (not `type:`) so this composes with
				// mediaFilter's own `type` key instead of overwriting it.
				media: { ...mediaFilter, NOT: { type: MediaType.TVSHOW } },
				role: { name: { in: Object.values(PERSON_ROLE_NAMES).flat() } },
				// Director's order/character are always null — each branch below
				// explicitly keeps null, since SQL's NOT(NULL ...) is NULL not true.
				AND: [
					// No dedicated voice-role flag — TMDB bakes it into the character
					// string instead (e.g. "Woody (voice)").
					{
						OR: [
							{ character: null },
							{ NOT: { character: { contains: "(voice)" } } },
						],
					},
					// Top-billed only — excludes cameos/bit parts (see TOP_BILLING_CUTOFF).
					{ OR: [{ order: null }, { order: { lt: TOP_BILLING_CUTOFF } }] },
				],
			},
			select: {
				personId: true,
				mediaId: true,
				role: { select: { name: true } },
				media: { select: { review: { select: { rating: true } } } },
			},
		}),
	]);

	const typeStats = new Map<
		MediaType,
		{ count: number; ratingSum: number; ratingCount: number }
	>();
	for (const m of typeMediaRows) {
		const stat = typeStats.get(m.type) ?? {
			count: 0,
			ratingSum: 0,
			ratingCount: 0,
		};
		stat.count++;
		if (m.review?.rating != null) {
			stat.ratingSum += m.review.rating;
			stat.ratingCount++;
		}
		typeStats.set(m.type, stat);
	}
	const byType = MEDIA_TYPE_ORDER.map((t) => {
		const stat = typeStats.get(t);
		return {
			type: t,
			count: stat?.count ?? 0,
			avgRating:
				stat && stat.ratingCount > 0 ? stat.ratingSum / stat.ratingCount : null,
		};
	});

	const countryCodeById = new Map(countries.map((c) => [c.id, c.countryCode2]));
	const countryStats = new Map<
		number,
		{ count: number; ratingSum: number; ratingCount: number }
	>();
	for (const m of countryMediaRows) {
		const stat = countryStats.get(m.countryId!) ?? {
			count: 0,
			ratingSum: 0,
			ratingCount: 0,
		};
		stat.count++;
		if (m.review?.rating != null) {
			stat.ratingSum += m.review.rating;
			stat.ratingCount++;
		}
		countryStats.set(m.countryId!, stat);
	}
	const worldMap = [...countryStats.entries()]
		.map(([countryId, stat]) => {
			const code = countryCodeById.get(countryId);
			if (!code) return null;
			return {
				code,
				name: COUNTRY_NAME_BY_CODE.get(code) ?? code,
				count: stat.count,
				avgRating:
					stat.ratingCount > 0 ? stat.ratingSum / stat.ratingCount : null,
			};
		})
		.filter((c) => c !== null)
		.sort((a, b) => b.count - a.count);
	const topCountries = worldMap.slice(0, 8);

	// Caps genre "tags" per title before counting — MangaDex returns loose
	// lists of up to 12 (vs. TMDB's curated ~3) that would otherwise dominate.
	const MAX_GENRES_PER_MEDIA = 10;
	const genreRowCountByMedia = new Map<number, number>();
	const cappedGenreMediaRows = genreMediaRows.filter((g) => {
		const seen = genreRowCountByMedia.get(g.mediaId) ?? 0;
		genreRowCountByMedia.set(g.mediaId, seen + 1);
		return seen < MAX_GENRES_PER_MEDIA;
	});

	// Animation/Family are format/audience tags, not genre info; the rest sit
	// on 25-35% of the catalog — too broad to be distinctive in the ranking.
	const EXCLUDED_GENRES = new Set([
		"Animation",
		"Family",
		"Adventure",
		"Comedy",
		"Drama",
		"Action",
		"Fantasy",
		"Thriller",
	]);

	const genreNameById = new Map(genres.map((g) => [g.id, g.name]));
	const genreStatsByName = new Map<
		string,
		{ count: number; ratingSum: number; ratingCount: number }
	>();
	for (const g of cappedGenreMediaRows) {
		const name = genreNameById.get(g.genreId);
		if (!name || EXCLUDED_GENRES.has(name)) continue;
		const stat = genreStatsByName.get(name) ?? {
			count: 0,
			ratingSum: 0,
			ratingCount: 0,
		};
		stat.count++;
		const rating = g.media.review?.rating;
		if (rating != null) {
			stat.ratingSum += rating;
			stat.ratingCount++;
		}
		genreStatsByName.set(name, stat);
	}
	// Full list, not just top 7 — the client re-ranks by count or avg rating
	// depending on its own toggle, same as the world map's top-countries list.
	const genreStats = [...genreStatsByName.entries()].map(([name, stat]) => ({
		name,
		count: stat.count,
		avgRating: stat.ratingCount > 0 ? stat.ratingSum / stat.ratingCount : null,
	}));

	const ratingCounts = new Array<number>(RATING_TIER_COUNT).fill(0);
	let unrated = 0;
	for (const { rating } of reviewRatings) {
		if (rating == null) {
			unrated++;
			continue;
		}
		const tier = Math.min(Math.floor(rating), RATING_TIER_COUNT - 1);
		ratingCounts[tier] = (ratingCounts[tier] ?? 0) + 1;
	}

	// Longest run of consecutive calendar days (UTC) with at least one review,
	// within the same year/type scope as the rest of the tiles.
	const reviewDayKeys = [
		...new Set(
			reviewRatings.map((r) => Math.floor(r.createDate.getTime() / 86400000)),
		),
	].sort((a, b) => a - b);
	let longestStreakDays = reviewDayKeys.length > 0 ? 1 : 0;
	let currentStreak = longestStreakDays;
	for (let i = 1; i < reviewDayKeys.length; i++) {
		const prevDay = reviewDayKeys[i - 1] as number;
		const day = reviewDayKeys[i] as number;
		currentStreak = day - prevDay === 1 ? currentStreak + 1 : 1;
		longestStreakDays = Math.max(longestStreakDays, currentStreak);
	}

	const reviewsByYearMap = new Map<number, number>();
	for (const { createDate } of allReviewDates) {
		const y = createDate.getUTCFullYear();
		reviewsByYearMap.set(y, (reviewsByYearMap.get(y) ?? 0) + 1);
	}
	const reviewsByYear = [...reviewsByYearMap.entries()]
		.map(([y, count]) => ({ year: y, count }))
		.sort((a, b) => a.year - b.year);
	const years = reviewsByYear.map((y) => y.year);

	const mediaByDecadeMap = new Map<number, number>();
	for (const { releaseDate } of mediaReleaseDates) {
		const decade = Math.floor(releaseDate!.getUTCFullYear() / 10) * 10;
		mediaByDecadeMap.set(decade, (mediaByDecadeMap.get(decade) ?? 0) + 1);
	}
	const mediaByDecade = [...mediaByDecadeMap.entries()]
		.map(([decade, count]) => ({ decade, count }))
		.sort((a, b) => a.decade - b.decade);

	// personId -> mediaId -> rating — mediaId-keyed so a person double-credited
	// under two role names in the same category (e.g. Screenplay + Story) counts once.
	const byRole: Record<PersonRole, Map<number, Map<number, number | null>>> = {
		ACTOR: new Map(),
		DIRECTOR: new Map(),
	};
	const roleByName = new Map<string, PersonRole>(
		Object.entries(PERSON_ROLE_NAMES).flatMap(([role, names]) =>
			names.map((name) => [name, role as PersonRole]),
		),
	);
	for (const c of personCredits) {
		const role = roleByName.get(c.role.name);
		if (!role) continue;
		const personMedia =
			byRole[role].get(c.personId!) ?? new Map<number, number | null>();
		personMedia.set(c.mediaId, c.media.review?.rating ?? null);
		byRole[role].set(c.personId!, personMedia);
	}

	function summarize(mediaMap: Map<number, number | null>) {
		const ratings = [...mediaMap.values()].filter(
			(r): r is number => r != null,
		);
		return {
			count: mediaMap.size,
			avgRating:
				ratings.length > 0
					? ratings.reduce((a, b) => a + b, 0) / ratings.length
					: null,
		};
	}

	const neededPersonIds = new Set<number>();
	const roleRankingIds: Record<
		PersonRole,
		{ byTitles: number[]; byRating: number[] }
	> = {
		ACTOR: { byTitles: [], byRating: [] },
		DIRECTOR: { byTitles: [], byRating: [] },
	};
	for (const role of Object.keys(byRole) as PersonRole[]) {
		const entries = [...byRole[role].entries()].map(
			([personId, mediaMap]) => [personId, summarize(mediaMap)] as const,
		);
		const byTitles = entries
			.slice()
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, TOP_PEOPLE_COUNT)
			.map(([id]) => id);
		const byRating = entries
			.filter(
				([, s]) =>
					s.avgRating != null && s.count >= MIN_SAMPLE_FOR_PERSON_RATING,
			)
			.sort((a, b) => b[1].avgRating! - a[1].avgRating!)
			.slice(0, TOP_PEOPLE_COUNT)
			.map(([id]) => id);
		roleRankingIds[role] = { byTitles, byRating };
		for (const id of [...byTitles, ...byRating]) neededPersonIds.add(id);
	}
	const people = await db.person.findMany({
		where: { id: { in: [...neededPersonIds] } },
		select: { id: true, name: true, photoPath: true },
	});
	const personById = new Map(people.map((p) => [p.id, p]));
	const topPeople = Object.fromEntries(
		(Object.keys(byRole) as PersonRole[]).map((role) => {
			const toPersonStat = (id: number) => {
				const stat = summarize(byRole[role].get(id)!);
				const person = personById.get(id);
				return {
					id,
					name: person?.name ?? "?",
					photoSrc: toPersonPhotoSrc(id, person?.photoPath ?? null),
					...stat,
				};
			};
			return [
				role,
				{
					byTitles: roleRankingIds[role].byTitles.map(toPersonStat),
					byRating: roleRankingIds[role].byRating.map(toPersonStat),
				},
			];
		}),
	) as Record<PersonRole, { byTitles: PersonStat[]; byRating: PersonStat[] }>;

	return {
		year,
		years,
		type,
		totals: {
			titles,
			longestStreakDays,
			reviewsWritten,
			avgRating: avgRatingResult._avg.rating,
			movieMinutesWatched: movieRuntimeResult._sum.runtime ?? 0,
		},
		byType,
		topGenres: genreStats,
		topCountries,
		worldMap,
		topPeople,
		ratingHistogram: { counts: ratingCounts, unrated },
		reviewsByYear,
		mediaByDecade,
	};
}
