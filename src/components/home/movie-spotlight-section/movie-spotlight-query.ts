import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import {
	MediaCardRecord,
	toMediaCardRecord,
	toMediaRecord,
} from "@/components/media/types";
import { sample } from "@/components/home/home-rotation";

export const MOVIE_SPOTLIGHT_COUNT = 14;
// Out of 10, exclusive.
const MIN_RATING = 6.5;

const WHERE: Prisma.MediaWhereInput = {
	type: MediaType.MOVIE,
	enrichmentStatus: EnrichmentStatus.DONE,
	isAdult: false,
	review: { rating: { gt: MIN_RATING } },
};

// Random well-rated movies; excludeIds (the row currently shown) is skipped unless that leaves too few.
export async function loadMovieSpotlight(
	excludeIds: number[],
): Promise<MediaCardRecord[]> {
	const candidates = (
		await dbPublic.media.findMany({ where: WHERE, select: { id: true } })
	).map((c) => c.id);
	const excluded = new Set(excludeIds);
	const fresh = candidates.filter((id) => !excluded.has(id));
	const ids = sample(
		fresh.length >= MOVIE_SPOTLIGHT_COUNT ? fresh : candidates,
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
