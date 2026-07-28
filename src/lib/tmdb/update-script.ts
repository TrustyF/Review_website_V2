import { TmdbMovieResponse } from "@/lib/tmdb/request-schema";
import { db } from "@/lib/prisma/db";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { resolveCountry } from "@/services/resolvers/entity-resolver";
import { syncMovieCreditsAndGenres } from "@/lib/tmdb/sync-movie-credits";

export async function updateMovieFromTmdb(data: TmdbMovieResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.MOVIE },
		});
		if (!existing)
			throw new Error(
				`updateMovieFromTmdb: no movie found for externalId ${externalId}`,
			);

		console.log(`attempting ${existing.title}`);

		const country = data.origin_country?.[0]
			? await resolveCountry(tx, data.origin_country[0])
			: null;

		await tx.media.update({
			where: { id: existing.id },
			data: {
				title: data.title,
				overview: data.overview,
				releaseDate: data.release_date ? new Date(data.release_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				countryId: country?.id ?? null,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				movie: {
					update: {
						runtime: data.runtime,
						budget: data.budget,
						revenue: data.revenue,
						tagline: data.tagline,
						imdbID: data.imdb_id,
						originalLanguage: data.original_language,
					},
				},
			},
		});

		await syncMovieCreditsAndGenres(tx, existing.id, data);

		return existing;
	});
}
