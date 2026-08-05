import { EnrichmentStatus, MediaType } from "@prisma/client";
import { TmdbMovieResponse } from "@/server/tmdb/schema";
import { db } from "@/server/db/client";
import { resolveCountry } from "@/server/resolvers/entity-resolver";
import { syncMovieCreditsAndGenres } from "@/server/tmdb/ingest/movie-credits";
import { fetchTmdbImages, pickBestBackdrop } from "@/server/tmdb/client";

// A movie's externalId is looked up against both MOVIE and SHORT — TMDB
// has no separate id space for shorts, they're plain movie entries, and
// some rows get reclassified to SHORT after creation. Matching MOVIE only
// would miss an existing SHORT row entirely: add would create a duplicate,
// and update (called for SHORT rows too, see enrich-db.ts) would 404 on a
// row that actually exists.
const MOVIE_OR_SHORT = [MediaType.MOVIE, MediaType.SHORT];

export async function addMovieFromTmdb(data: TmdbMovieResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: { in: MOVIE_OR_SHORT } },
		});
		if (existing) return existing;

		const country = data.origin_country?.[0]
			? await resolveCountry(tx, data.origin_country[0])
			: null;

		const images = await fetchTmdbImages(externalId, MediaType.MOVIE);
		const bannerPath = pickBestBackdrop(images.backdrops) ?? data.backdrop_path;

		const media = await tx.media.create({
			data: {
				title: data.title,
				type: MediaType.MOVIE,
				overview: data.overview,
				externalId,
				releaseDate: data.release_date ? new Date(data.release_date) : null,
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				bannerPath,
				countryId: country?.id ?? null,
				sourceUrl: `https://www.themoviedb.org/movie/${externalId}`,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
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

export async function updateMovieFromTmdb(data: TmdbMovieResponse) {
	const externalId = String(data.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: { in: MOVIE_OR_SHORT } },
			include: { movie: true },
		});
		if (!existing)
			throw new Error(
				`updateMovieFromTmdb: no movie found for externalId ${externalId}`,
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
				(await fetchTmdbImages(externalId, MediaType.MOVIE)).backdrops,
			) ??
			data.backdrop_path;

		// Re-enrichment only fills in fields that are still empty — anything
		// already set (whether from a prior ingest or a hand edit in the media
		// editor) is left alone. budget/revenue/publicRating are the exception:
		// those genuinely change over time at the source, so they always refresh.
		await tx.media.update({
			where: { id: existing.id },
			data: {
				title: existing.title ?? data.title,
				overview: existing.overview ?? data.overview,
				releaseDate:
					existing.releaseDate ??
					(data.release_date ? new Date(data.release_date) : null),
				publicRating: data.vote_average,
				posterPath: existing.posterPath ?? data.poster_path,
				bannerPath,
				countryId: existing.countryId ?? (country?.id ?? null),
				sourceUrl: `https://www.themoviedb.org/movie/${externalId}`,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				movie: {
					update: {
						runtime: existing.movie?.runtime ?? data.runtime,
						budget: data.budget,
						revenue: data.revenue,
						tagline: existing.movie?.tagline ?? data.tagline,
						imdbID: existing.movie?.imdbID ?? data.imdb_id,
						originalLanguage:
							existing.movie?.originalLanguage ?? data.original_language,
					},
				},
			},
		});

		await syncMovieCreditsAndGenres(tx, existing.id, data);

		return existing;
	});
}
