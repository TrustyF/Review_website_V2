import { EnrichmentStatus, MediaType } from "@prisma/client";
import { TmdbTvResponse } from "@/server/tmdb/schema";
import { db } from "@/server/db/client";
import { resolveCountry } from "@/server/resolvers/entity-resolver";
import { syncTvShowCreditsAndGenres } from "@/server/tmdb/ingest/tv-show-credits";
import { fetchTmdbImages, pickBestBackdrop } from "@/server/tmdb/client";

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

		const images = await fetchTmdbImages(externalId, MediaType.TVSHOW);
		const bannerPath = pickBestBackdrop(images.backdrops) ?? data.backdrop_path;

		const media = await tx.media.create({
			data: {
				title: data.name,
				type: MediaType.TVSHOW,
				overview: data.overview,
				externalId,
				releaseDate: data.first_air_date ? new Date(data.first_air_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				bannerPath,
				countryId: country?.id ?? null,
				sourceUrl: `https://www.themoviedb.org/tv/${externalId}`,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				tvShow: {
					create: {
						episodeCount: data.number_of_episodes,
						seasonCount: data.number_of_seasons,
						network: data.networks[0]?.name ?? null,
						popularity: data.popularity,
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
			include: { tvShow: true },
		});
		if (!existing)
			throw new Error(
				`updateTvShowFromTmdb: no tv show found for externalId ${externalId}`,
			);

		const country = data.origin_country?.[0]
			? await resolveCountry(tx, data.origin_country[0])
			: null;

		// Only hits TMDB's images endpoint when a banner is actually still
		// missing — bulk re-enrichment (enrich-db.ts, backfill-banners.ts)
		// runs this over every row, most of which already have one.
		const bannerPath =
			existing.bannerPath ??
			pickBestBackdrop(
				(await fetchTmdbImages(externalId, MediaType.TVSHOW)).backdrops,
			) ??
			data.backdrop_path;

		// Re-enrichment only fills in fields that are still empty — anything
		// already set (whether from a prior ingest or a hand edit in the media
		// editor) is left alone. publicRating/popularity are the exception:
		// they genuinely change over time at the source, so they always refresh.
		await tx.media.update({
			where: { id: existing.id },
			data: {
				title: existing.title ?? data.name,
				overview: existing.overview ?? data.overview,
				releaseDate:
					existing.releaseDate ??
					(data.first_air_date ? new Date(data.first_air_date) : null),
				publicRating: data.vote_average,
				posterPath: existing.posterPath ?? data.poster_path,
				bannerPath,
				countryId: existing.countryId ?? (country?.id ?? null),
				sourceUrl: `https://www.themoviedb.org/tv/${externalId}`,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				tvShow: {
					update: {
						episodeCount:
							existing.tvShow?.episodeCount ?? data.number_of_episodes,
						seasonCount: existing.tvShow?.seasonCount ?? data.number_of_seasons,
						network: existing.tvShow?.network ?? (data.networks[0]?.name ?? null),
						// Refreshed every re-enrich, not just filled in once — see
						// the field's own comment in media.prisma.
						popularity: data.popularity,
					},
				},
			},
		});

		await syncTvShowCreditsAndGenres(tx, existing.id, data);

		return existing;
	});
}
