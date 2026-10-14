import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import {
	MediaCardRecord,
	toMediaCardRecord,
	toMediaRecord,
} from "@/components/media/types";
import { sample } from "@/components/home/home-rotation";

export const MOVIE_SPOTLIGHT_COUNT = 14;
// Out of 10. Ratings above GOOD_RATING always qualify; MIN_RATING up to it get LOW_RATING_WEIGHT odds.
const GOOD_RATING = 6.5;
const MIN_RATING = 6;
const LOW_RATING_WEIGHT = 0.25;

const WHERE: Prisma.MediaWhereInput = {
	type: MediaType.MOVIE,
	enrichmentStatus: EnrichmentStatus.DONE,
	isAdult: false,
	review: { rating: { gte: MIN_RATING } },
};

type Candidate = { id: number; weight: number };

// Weighted sample without replacement (Efraimidis–Spirakis): highest random^(1/weight) wins.
function weightedSample(items: Candidate[], count: number): number[] {
	return items
		.map((c) => ({ id: c.id, key: Math.random() ** (1 / c.weight) }))
		.sort((a, b) => b.key - a.key)
		.slice(0, count)
		.map((c) => c.id);
}

// Random well-rated movies, with the occasional 6/10; excludeIds (the row currently shown) is skipped unless that leaves too few.
export async function loadMovieSpotlight(
	excludeIds: number[],
): Promise<MediaCardRecord[]> {
	const candidates: Candidate[] = (
		await dbPublic.media.findMany({
			where: WHERE,
			select: { id: true, review: { select: { rating: true } } },
		})
	).map((c) => ({
		id: c.id,
		weight: (c.review?.rating ?? 0) > GOOD_RATING ? 1 : LOW_RATING_WEIGHT,
	}));
	const excluded = new Set(excludeIds);
	const fresh = candidates.filter((c) => !excluded.has(c.id));
	const ids = sample(
		weightedSample(
			fresh.length >= MOVIE_SPOTLIGHT_COUNT ? fresh : candidates,
			MOVIE_SPOTLIGHT_COUNT,
		),
		MOVIE_SPOTLIGHT_COUNT,
	);
	if (ids.length === 0) return [];

	const raw = await dbPublic.media.findMany({
		where: { id: { in: ids } },
		include: { movie: true, review: true },
	});
	// findMany ignores `in` order; restore the shuffled one.
	const byId = new Map(raw.map((m) => [m.id, m]));
	return ids
		.map((id) => byId.get(id))
		.filter((m) => m !== undefined)
		.map((m) => toMediaCardRecord(toMediaRecord(m)));
}
