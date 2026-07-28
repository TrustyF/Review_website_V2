import { MediaType } from "@prisma/client";
import { TmdbMovieResponse } from "@/lib/tmdb/request-schema";
import { db } from "@/lib/prisma/db";
import { resolveCountry } from "@/services/resolvers/entity-resolver";
import { syncMovieCreditsAndGenres } from "@/lib/tmdb/sync-movie-credits";

export async function addMovieFromTmdb(data: TmdbMovieResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.MOVIE },
		});
		if (existing) return existing;

		const country = data.origin_country?.[0]
			? await resolveCountry(tx, data.origin_country[0])
			: null;

		const media = await tx.media.create({
			data: {
				title: data.title,
				type: MediaType.MOVIE,
				overview: data.overview,
				externalId,
				releaseDate: data.release_date ? new Date(data.release_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				countryId: country?.id ?? null,
				movie: {
					create: {
						runtime: data.runtime ?? 0,
						budget: data.budget,
						revenue: data.revenue,
						tagline: data.tagline,
						imdbID: data.imdb_id,
						originalLanguage: data.original_language,
					},
				},
			},
		});

		await syncMovieCreditsAndGenres(tx, media.id, data);

		return media;
	});
}
