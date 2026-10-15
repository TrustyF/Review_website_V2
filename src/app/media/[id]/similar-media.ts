import { cache } from "react";
import { unstable_cache } from "next/cache";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import { db, dbPublic } from "@/server/db/client";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";
import {
	MediaCardRecord,
	toMediaCardRecord,
	toMediaRecord,
} from "@/components/media/types";

export const SIMILAR_COUNT = 12;
// Out of 10; anything rated lower isn't worth recommending.
const MIN_RATING = 5;
// Cast below this billing order counts as a shared person; the long tail doesn't.
const TOP_BILLED = 10;
// Below this, candidates only share something incidental (one broad genre, a big studio).
const MIN_RELEVANCE = 2;
// Titles without keywords (manga, books, comics, games) can't earn keyword points, so their bar is lower.
const MIN_RELEVANCE_NO_KEYWORDS = 1.5;

// Credit roles that make two titles feel alike, and how much one shared name is worth (before rarity).
// Kept modest: a shared director or cast hints at similarity but doesn't make two titles alike.
const ROLE_WEIGHTS: Record<string, number> = {
	Director: 1.5,
	Creator: 1.5,
	Author: 1.5,
	Developer: 1.5,
	Writer: 1,
	Screenplay: 1,
	Story: 1,
	Artist: 1,
	Actor: 0.75,
	"Original Music Composer": 0.5,
	"Director of Photography": 0.5,
	Studio: 0.5,
};
const MAX_PEOPLE_SCORE = 2.5;
// Max for an identical (rarity-weighted) genre set.
const GENRE_MAX = 3;
// Points per fully-rare shared keyword, and the cap on their sum.
const KEYWORD_POINTS = 1;
const KEYWORD_MAX = 3;
// Both scaled by rarity, so sharing English or the US is worth little and sharing Korean a lot.
const LANGUAGE_SCORE = 1.5;
// Below language since it mostly overlaps it; still the only locale signal for non-TMDB types.
const COUNTRY_SCORE = 0.5;
const ERA_MAX = 0.75;
const ERA_SPAN_YEARS = 15;
// Rarity weight never drops below this, so even a near-universal genre counts for something.
const IDF_FLOOR = 0.1;
// Score multiplier by how many notches apart two difficulties are (none/0, medium/1, hard/2).
// A multiplier, not added relevance: most titles share "none", which shouldn't help them clear MIN_RELEVANCE.
const DIFFICULTY_FACTORS = [1.25, 1, 0.7];
// Rating multiplier spans RATING_FLOOR (at 0/10) to 1 (at 10/10); liked titles get LIKED_BOOST on top.
const RATING_FLOOR = 0.4;
const LIKED_BOOST = 1.2;

// Per-category points behind a candidate's rank; shown under each card in dev only.
export type SimilarScore = {
	genre: number;
	keywords: number;
	people: number;
	language: number;
	country: number;
	era: number;
	// Multipliers applied to the summed relevance above.
	rating: number;
	difficulty: number;
	total: number;
};
type ScoredId = { id: number; score: SimilarScore };
type ScoredCandidate = ScoredId & { collectionId: number | null };

const CREDIT_FILTER: Prisma.CreditWhereInput = {
	OR: [
		{
			role: {
				name: { in: Object.keys(ROLE_WEIGHTS).filter((r) => r !== "Actor") },
			},
		},
		{ role: { name: "Actor" }, order: { lt: TOP_BILLED } },
	],
};

// Media outside this collection. A plain NOT on collectionId would also drop collection-less movies (NULL comparison).
function outsideCollection(
	collectionId: number | null | undefined,
): Prisma.MediaWhereInput {
	if (collectionId == null) return {};
	return {
		AND: {
			OR: [
				{ movie: null },
				{ movie: { collectionId: null } },
				{ movie: { collectionId: { not: collectionId } } },
			],
		},
	};
}

// 1 for something on a single title, falling toward IDF_FLOOR as it approaches every title of the type.
function idf(df: number, n: number): number {
	if (n <= 1 || df <= 1) return 1;
	return Math.min(1, Math.max(IDF_FLOOR, Math.log(n / df) / Math.log(n)));
}

type CreditKeyRow = {
	personId: number | null;
	companyId: number | null;
	role: { name: string };
};

function creditKey(personId: number | null, companyId: number | null) {
	if (personId != null) return `p${personId}`;
	if (companyId != null) return `c${companyId}`;
	return null;
}

// Highest weight per person/company across all their roles on this title.
function weightedKeys(credits: CreditKeyRow[]): Map<string, number> {
	const keys = new Map<string, number>();
	for (const c of credits) {
		const key = creditKey(c.personId, c.companyId);
		const weight = ROLE_WEIGHTS[c.role.name];
		if (key && weight) keys.set(key, Math.max(keys.get(key) ?? 0, weight));
	}
	return keys;
}

// Rarity weights from how many same-type titles share each genre, or the source's keywords/people/language/country.
async function loadRarity(
	type: MediaType,
	keywordIds: number[],
	personIds: number[],
	companyIds: number[],
	language: string | null | undefined,
	countryId: number | null,
) {
	const ofType: Prisma.MediaWhereInput = {
		type,
		isDeleted: false,
		enrichmentStatus: EnrichmentStatus.DONE,
	};
	const [
		n,
		genres,
		keywords,
		personPairs,
		companyPairs,
		languageCount,
		countryCount,
	] = await Promise.all([
		db.media.count({ where: ofType }),
		db.mediaGenre.groupBy({
			by: ["genreId"],
			where: { media: ofType },
			_count: { _all: true },
		}),
		db.mediaKeyword.groupBy({
			by: ["keywordId"],
			where: { keywordId: { in: keywordIds }, media: ofType },
			_count: { _all: true },
		}),
		// Grouped by (person, media) so several roles on one title count once.
		db.credit.groupBy({
			by: ["personId", "mediaId"],
			where: { personId: { in: personIds }, media: ofType },
		}),
		db.credit.groupBy({
			by: ["companyId", "mediaId"],
			where: { companyId: { in: companyIds }, media: ofType },
		}),
		language != null
			? db.media.count({
					where: {
						...ofType,
						OR: [
							{ movie: { originalLanguage: language } },
							{ tvShow: { originalLanguage: language } },
						],
					},
				})
			: 0,
		countryId != null ? db.media.count({ where: { ...ofType, countryId } }) : 0,
	]);

	const creditDf = new Map<string, number>();
	const countKey = (key: string | null) => {
		if (key) creditDf.set(key, (creditDf.get(key) ?? 0) + 1);
	};
	for (const pair of personPairs) countKey(creditKey(pair.personId, null));
	for (const pair of companyPairs) countKey(creditKey(null, pair.companyId));

	const genreWeights = new Map(
		genres.map((g) => [g.genreId, idf(g._count._all, n)]),
	);
	const keywordWeights = new Map(
		keywords.map((k) => [k.keywordId, idf(k._count._all, n)]),
	);
	return {
		genre: (id: number) => genreWeights.get(id) ?? 1,
		keyword: (id: number) => keywordWeights.get(id) ?? 1,
		credit: (key: string) => idf(creditDf.get(key) ?? 1, n),
		language: idf(languageCount, n),
		country: idf(countryCount, n),
	};
}

// Same-type titles you've rated, ranked by overlap with this one, then nudged by your rating.
async function querySimilarIds(mediaId: number): Promise<ScoredId[]> {
	const source = await db.media.findUnique({
		where: { id: mediaId },
		select: {
			type: true,
			isAdult: true,
			review: { select: { difficulty: true } },
			countryId: true,
			releaseDate: true,
			movie: { select: { collectionId: true, originalLanguage: true } },
			tvShow: { select: { originalLanguage: true } },
			mediaGenres: { select: { genreId: true } },
			mediaKeywords: { select: { keywordId: true } },
			credits: {
				where: CREDIT_FILTER,
				select: {
					personId: true,
					companyId: true,
					role: { select: { name: true } },
				},
			},
		},
	});
	if (!source) return [];

	const genreIds = new Set(source.mediaGenres.map((g) => g.genreId));
	const keywordIds = source.mediaKeywords.map((k) => k.keywordId);
	const sourceKeys = weightedKeys(source.credits);
	const personIds = source.credits.flatMap((c) => c.personId ?? []);
	const companyIds = source.credits.flatMap((c) => c.companyId ?? []);
	if (genreIds.size === 0 && keywordIds.length === 0 && sourceKeys.size === 0)
		return [];

	const sharedCredit: Prisma.CreditWhereInput = {
		AND: [
			CREDIT_FILTER,
			{
				OR: [
					{ personId: { in: personIds } },
					{ companyId: { in: companyIds } },
				],
			},
		],
	};

	const sourceLanguage =
		source.movie?.originalLanguage ?? source.tvShow?.originalLanguage;
	const [rarity, candidates] = await Promise.all([
		loadRarity(
			source.type,
			keywordIds,
			personIds,
			companyIds,
			sourceLanguage,
			source.countryId,
		),
		dbPublic.media.findMany({
			where: {
				id: { not: mediaId },
				type: source.type,
				enrichmentStatus: EnrichmentStatus.DONE,
				...(source.isAdult ? {} : { isAdult: false }),
				review: { rating: { gte: MIN_RATING } },
				// Same-franchise entries already get their own collection section.
				...outsideCollection(source.movie?.collectionId),
				OR: [
					{ mediaGenres: { some: { genreId: { in: [...genreIds] } } } },
					{ mediaKeywords: { some: { keywordId: { in: keywordIds } } } },
					{ credits: { some: sharedCredit } },
				],
			},
			select: {
				id: true,
				countryId: true,
				releaseDate: true,
				movie: { select: { originalLanguage: true, collectionId: true } },
				tvShow: { select: { originalLanguage: true } },
				review: { select: { rating: true, liked: true, difficulty: true } },
				mediaGenres: { select: { genreId: true } },
				mediaKeywords: {
					where: { keywordId: { in: keywordIds } },
					select: { keywordId: true },
				},
				credits: {
					where: sharedCredit,
					select: {
						personId: true,
						companyId: true,
						role: { select: { name: true } },
					},
				},
			},
		}),
	]);

	let sourceGenreWeight = 0;
	for (const id of genreIds) sourceGenreWeight += rarity.genre(id);
	const sourceYear = source.releaseDate?.getFullYear();
	// null and 0 both mean no difficulty notch (see Review.difficulty).
	const sourceDifficulty = source.review?.difficulty ?? 0;
	const minRelevance =
		keywordIds.length > 0 ? MIN_RELEVANCE : MIN_RELEVANCE_NO_KEYWORDS;

	const scored = candidates.flatMap((c): ScoredCandidate[] => {
		// Rarity-weighted Jaccard: sharing "Western" counts far more than sharing "Drama".
		let sharedGenreWeight = 0;
		let unionGenreWeight = sourceGenreWeight;
		for (const { genreId } of c.mediaGenres) {
			if (genreIds.has(genreId)) sharedGenreWeight += rarity.genre(genreId);
			else unionGenreWeight += rarity.genre(genreId);
		}
		const genreScore =
			unionGenreWeight > 0
				? (GENRE_MAX * sharedGenreWeight) / unionGenreWeight
				: 0;

		// Only shared keywords are selected, so this is just their summed rarity.
		let keywordScore = 0;
		for (const { keywordId } of c.mediaKeywords)
			keywordScore += KEYWORD_POINTS * rarity.keyword(keywordId);
		keywordScore = Math.min(keywordScore, KEYWORD_MAX);

		// Weight from the source side: this title's director matching their actor still counts.
		let peopleScore = 0;
		for (const key of weightedKeys(c.credits).keys())
			peopleScore += (sourceKeys.get(key) ?? 0) * rarity.credit(key);
		peopleScore = Math.min(peopleScore, MAX_PEOPLE_SCORE);

		const language = c.movie?.originalLanguage ?? c.tvShow?.originalLanguage;
		const languageScore =
			sourceLanguage != null && language === sourceLanguage
				? LANGUAGE_SCORE * rarity.language
				: 0;
		const countryScore =
			source.countryId != null && c.countryId === source.countryId
				? COUNTRY_SCORE * rarity.country
				: 0;
		const candidateYear = c.releaseDate?.getFullYear();
		const eraScore =
			sourceYear != null && candidateYear != null
				? ERA_MAX *
					Math.max(0, 1 - Math.abs(sourceYear - candidateYear) / ERA_SPAN_YEARS)
				: 0;

		const relevance =
			genreScore +
			keywordScore +
			peopleScore +
			languageScore +
			countryScore +
			eraScore;
		if (relevance < minRelevance) return [];
		const rating = c.review?.rating ?? MIN_RATING;
		const difficultyGap = Math.abs(
			(c.review?.difficulty ?? 0) - sourceDifficulty,
		);
		const ratingFactor =
			(RATING_FLOOR + ((1 - RATING_FLOOR) * rating) / 10) *
			(c.review?.liked ? LIKED_BOOST : 1);
		const difficultyFactor = DIFFICULTY_FACTORS[difficultyGap] ?? 1;
		return [
			{
				id: c.id,
				collectionId: c.movie?.collectionId ?? null,
				score: {
					genre: genreScore,
					keywords: keywordScore,
					people: peopleScore,
					language: languageScore,
					country: countryScore,
					era: eraScore,
					rating: ratingFactor,
					difficulty: difficultyFactor,
					total: relevance * ratingFactor * difficultyFactor,
				},
			},
		];
	});

	// Best-scoring entry per collection only, so one franchise can't fill the row.
	const seenCollections = new Set<number>();
	const picked: ScoredId[] = [];
	for (const { id, score, collectionId } of scored.sort(
		(a, b) => b.score.total - a.score.total,
	)) {
		if (collectionId != null) {
			if (seenCollections.has(collectionId)) continue;
			seenCollections.add(collectionId);
		}
		picked.push({ id, score });
		if (picked.length === SIMILAR_COUNT) break;
	}
	return picked;
}

// Only ids + scores are cached: card records carry Dates that unstable_cache's JSON round trip would flatten.
const getSimilarIds = (mediaId: number) =>
	unstable_cache(
		() => querySimilarIds(mediaId),
		["media-similar-v8", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)();

export type SimilarItem = { media: MediaCardRecord; score: SimilarScore };

export const getSimilarMedia = cache(
	async (mediaId: number): Promise<SimilarItem[]> => {
		const [scored, source] = await Promise.all([
			getSimilarIds(mediaId),
			db.movie.findUnique({
				where: { mediaID: mediaId },
				select: { collectionId: true },
			}),
		]);
		if (scored.length === 0) return [];
		const raw = await dbPublic.media.findMany({
			where: {
				id: { in: scored.map((s) => s.id) },
				// Repeated uncached: the cached ids can predate this movie's collection being set.
				...outsideCollection(source?.collectionId),
			},
			include: {
				movie: true,
				tvShow: true,
				manga: true,
				comic: true,
				game: true,
				book: true,
				review: true,
			},
		});
		// findMany ignores `in` order; restore the ranked one.
		const byId = new Map(raw.map((m) => [m.id, m]));
		return scored.flatMap(({ id, score }) => {
			const m = byId.get(id);
			return m ? [{ media: toMediaCardRecord(toMediaRecord(m)), score }] : [];
		});
	},
);
