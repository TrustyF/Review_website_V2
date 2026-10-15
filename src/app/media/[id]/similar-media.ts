import { cache } from "react";
import { unstable_cache } from "next/cache";
import { EnrichmentStatus, Prisma } from "@prisma/client";
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

// Credit roles that make two titles feel alike, and how much one shared name is worth.
const ROLE_WEIGHTS: Record<string, number> = {
	Director: 3,
	Creator: 3,
	Author: 3,
	Developer: 3,
	Writer: 2,
	Screenplay: 2,
	Story: 2,
	Artist: 2,
	Actor: 1.5,
	"Original Music Composer": 1,
	"Director of Photography": 1,
	Studio: 1,
};
const MAX_PEOPLE_SCORE = 6;

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

type CreditKeyRow = {
	personId: number | null;
	companyId: number | null;
	role: { name: string };
};

function creditKey(c: CreditKeyRow): string | null {
	if (c.personId != null) return `p${c.personId}`;
	if (c.companyId != null) return `c${c.companyId}`;
	return null;
}

// Highest weight per person/company across all their roles on this title.
function weightedKeys(credits: CreditKeyRow[]): Map<string, number> {
	const keys = new Map<string, number>();
	for (const c of credits) {
		const key = creditKey(c);
		const weight = ROLE_WEIGHTS[c.role.name];
		if (key && weight) keys.set(key, Math.max(keys.get(key) ?? 0, weight));
	}
	return keys;
}

// Same-type titles you've rated, ranked by overlap with this one, then nudged by your rating.
async function querySimilarIds(mediaId: number): Promise<number[]> {
	const source = await db.media.findUnique({
		where: { id: mediaId },
		select: {
			type: true,
			isAdult: true,
			countryId: true,
			releaseDate: true,
			movie: { select: { collectionId: true } },
			mediaGenres: { select: { genreId: true } },
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
	const sourceKeys = weightedKeys(source.credits);
	const personIds = source.credits.flatMap((c) => c.personId ?? []);
	const companyIds = source.credits.flatMap((c) => c.companyId ?? []);
	if (genreIds.size === 0 && sourceKeys.size === 0) return [];

	const candidates = await dbPublic.media.findMany({
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
				{
					credits: {
						some: {
							AND: [
								CREDIT_FILTER,
								{
									OR: [
										{ personId: { in: personIds } },
										{ companyId: { in: companyIds } },
									],
								},
							],
						},
					},
				},
			],
		},
		select: {
			id: true,
			countryId: true,
			releaseDate: true,
			review: { select: { rating: true, liked: true } },
			mediaGenres: { select: { genreId: true } },
			credits: {
				where: {
					AND: [
						CREDIT_FILTER,
						{
							OR: [
								{ personId: { in: personIds } },
								{ companyId: { in: companyIds } },
							],
						},
					],
				},
				select: {
					personId: true,
					companyId: true,
					role: { select: { name: true } },
				},
			},
		},
	});

	const sourceYear = source.releaseDate?.getFullYear();
	const scored = candidates.flatMap((c) => {
		const candidateGenres = c.mediaGenres.map((g) => g.genreId);
		const shared = candidateGenres.filter((id) => genreIds.has(id)).length;
		const union = genreIds.size + candidateGenres.length - shared;
		const genreScore = union > 0 ? (3 * shared) / union : 0;

		// Weight from the source side: this title's director matching their actor still counts.
		let peopleScore = 0;
		for (const key of weightedKeys(c.credits).keys())
			peopleScore += sourceKeys.get(key) ?? 0;
		peopleScore = Math.min(peopleScore, MAX_PEOPLE_SCORE);

		const countryScore =
			source.countryId != null && c.countryId === source.countryId ? 0.5 : 0;
		const candidateYear = c.releaseDate?.getFullYear();
		const eraScore =
			sourceYear != null && candidateYear != null
				? 0.75 * Math.max(0, 1 - Math.abs(sourceYear - candidateYear) / 15)
				: 0;

		const relevance = genreScore + peopleScore + countryScore + eraScore;
		if (relevance < MIN_RELEVANCE) return [];
		const rating = c.review?.rating ?? MIN_RATING;
		const score =
			relevance * (0.6 + (0.4 * rating) / 10) * (c.review?.liked ? 1.15 : 1);
		return [{ id: c.id, score }];
	});

	return scored
		.sort((a, b) => b.score - a.score)
		.slice(0, SIMILAR_COUNT)
		.map((s) => s.id);
}

// Only ids are cached: card records carry Dates that unstable_cache's JSON round trip would flatten.
const getSimilarIds = (mediaId: number) =>
	unstable_cache(
		() => querySimilarIds(mediaId),
		["media-similar", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)();

export const getSimilarMedia = cache(
	async (mediaId: number): Promise<MediaCardRecord[]> => {
		const [ids, source] = await Promise.all([
			getSimilarIds(mediaId),
			db.movie.findUnique({
				where: { mediaID: mediaId },
				select: { collectionId: true },
			}),
		]);
		if (ids.length === 0) return [];
		const raw = await dbPublic.media.findMany({
			where: {
				id: { in: ids },
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
		return ids
			.map((id) => byId.get(id))
			.filter((m) => m !== undefined)
			.map((m) => toMediaCardRecord(toMediaRecord(m)));
	},
);
