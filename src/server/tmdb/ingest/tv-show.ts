import { EnrichmentStatus, MediaType } from "@prisma/client";
import { TmdbTvResponse } from "@/server/tmdb/schema";
import { db } from "@/server/db/client";
import { resolveCountry } from "@/server/resolvers/entity-resolver";
import { syncTvShowCreditsAndGenres } from "@/server/tmdb/ingest/tv-show-credits";

export async function addTvShowFromTmdb(data: TmdbTvResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.TVSHOW },
		});
		if (existing) return existing;

		const country = data.origin_country?.[0]
			? await resolveCountry(tx, data.origin_country[0])
			: null;

		const media = await tx.media.create({
			data: {
				title: data.name,
				type: MediaType.TVSHOW,
				overview: data.overview,
				externalId,
				releaseDate: data.first_air_date ? new Date(data.first_air_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				countryId: country?.id ?? null,
				tvShow: {
					create: {
						episodeCount: data.number_of_episodes,
						seasonCount: data.number_of_seasons,
						network: data.networks[0]?.name ?? null,
					},
				},
			},
		});

		await syncTvShowCreditsAndGenres(tx, media.id, data);

		return media;
	});
}

export async function updateTvShowFromTmdb(data: TmdbTvResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.TVSHOW },
		});
		if (!existing)
			throw new Error(
				`updateTvShowFromTmdb: no tv show found for externalId ${externalId}`,
			);

		const country = data.origin_country?.[0]
			? await resolveCountry(tx, data.origin_country[0])
			: null;

		await tx.media.update({
			where: { id: existing.id },
			data: {
				title: data.name,
				overview: data.overview,
				releaseDate: data.first_air_date ? new Date(data.first_air_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				countryId: country?.id ?? null,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				tvShow: {
					update: {
						episodeCount: data.number_of_episodes,
						seasonCount: data.number_of_seasons,
						network: data.networks[0]?.name ?? null,
					},
				},
			},
		});

		await syncTvShowCreditsAndGenres(tx, existing.id, data);

		return existing;
	});
}
