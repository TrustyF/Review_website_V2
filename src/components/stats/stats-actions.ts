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
const TOP_PEOPLE_COUNT = 10;
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

// "All" (year: null) matches today's catalog-wide behavior; a specific year
// narrows to media that was actually reviewed/watched that year.
function reviewedMediaFilter(year: number | null): Prisma.MediaWhereInput {
	const range = reviewYearRange(year);
	return range
		? { ...MEDIA_FILTER, review: { createDate: range } }
		: MEDIA_FILTER;
}

export async function getStats(year: number | null = null): Promise<StatsData> {
	const range = reviewYearRange(year);
	const mediaFilter = reviewedMediaFilter(year);

	const [
		titles,
		rated,
		reviewsWritten,
		avgRatingResult,
		movieRuntimeResult,
		byTypeRaw,
		countryMediaRows,
		countries,
		genreGroups,
		genres,
		reviewRatings,
		allReviewDates,
		mediaReleaseDates,
		personCredits,
	] = await Promise.all([
		db.media.count({ where: mediaFilter }),
		db.review.count({
			where: { media: MEDIA_FILTER, ...(range ? { createDate: range } : {}) },
		}),
		db.review.count({
			where: {
				media: MEDIA_FILTER,
				body: { not: null },
				...(range ? { createDate: range } : {}),
			},
		}),
		db.review.aggregate({
			where: { media: MEDIA_FILTER, ...(range ? { createDate: range } : {}) },
			_avg: { rating: true },
		}),
		db.movie.aggregate({
			where: { media: mediaFilter },
			_sum: { runtime: true },
		}),
		db.media.groupBy({ by: ["type"], where: mediaFilter, _count: true }),
		db.media.findMany({
			where: { ...mediaFilter, countryId: { not: null } },
			select: { countryId: true, review: { select: { rating: true } } },
		}),
		db.country.findMany({ select: { id: true, countryCode2: true } }),
		db.mediaGenre.groupBy({
			by: ["genreId"],
			where: { media: mediaFilter },
			_count: true,
		}),
		db.genre.findMany({ select: { id: true, name: true } }),
		db.review.findMany({
			where: { media: MEDIA_FILTER, ...(range ? { createDate: range } : {}) },
			select: { rating: true },
		}),
		// Always unscoped — this is what drives the year selector and the
		// "Reviews per year" chart, which stays full-history regardless of scope.
		db.review.findMany({
			where: { media: MEDIA_FILTER },
			select: { createDate: true },
		}),
		db.media.findMany({
			where: { ...mediaFilter, releaseDate: { not: null } },
			select: { releaseDate: true },
		}),
		db.credit.findMany({
			where: {
				personId: { not: null },
				// Top People is movie-only — a TV show's own Actor/Director credits
				// (a different pool of people, often billed for one episode) don't count.
				media: { ...mediaFilter, type: { not: MediaType.TVSHOW } },
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

	const byTypeCounts = new Map(byTypeRaw.map((g) => [g.type, g._count]));
	const byType = MEDIA_TYPE_ORDER.map((type) => ({
		type,
		count: byTypeCounts.get(type) ?? 0,
	}));

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

	const genreNameById = new Map(genres.map((g) => [g.id, g.name]));
	const genreCountByName = new Map<string, number>();
	for (const g of genreGroups) {
		const name = genreNameById.get(g.genreId);
		if (!name) continue;
		genreCountByName.set(name, (genreCountByName.get(name) ?? 0) + g._count);
	}
	const topGenres = [...genreCountByName.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

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
		totals: {
			titles,
			rated,
			reviewsWritten,
			avgRating: avgRatingResult._avg.rating,
			movieMinutesWatched: movieRuntimeResult._sum.runtime ?? 0,
		},
		byType,
		topGenres,
		topCountries,
		worldMap,
		topPeople,
		ratingHistogram: { counts: ratingCounts, unrated },
		reviewsByYear,
		mediaByDecade,
	};
}
