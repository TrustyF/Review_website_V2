import { MediaType, type Prisma } from "@prisma/client";
import type { TmdbMovieResponse } from "@/server/tmdb/schema";
import { syncTmdbCreditsAndGenres } from "@/server/tmdb/ingest/sync-credits";

export async function syncMovieCreditsAndGenres(
	tx: Prisma.TransactionClient,
	mediaId: number,
	data: TmdbMovieResponse,
) {
	await syncTmdbCreditsAndGenres(tx, mediaId, MediaType.MOVIE, {
		genres: data.genres ?? [],
		cast: data.credits?.cast ?? [],
		crew: data.credits?.crew ?? [],
		companies: data.production_companies ?? [],
	});
}
