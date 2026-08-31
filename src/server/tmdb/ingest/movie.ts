import { EnrichmentStatus, MediaStatus, MediaType } from "@prisma/client";
import { TmdbMovieResponse } from "@/server/tmdb/schema";
import { db } from "@/server/db/client";
import { resolveCountry } from "@/server/resolvers/entity-resolver";
import { syncMovieCreditsAndGenres } from "@/server/tmdb/ingest/movie-credits";
import { fetchTmdbImages, pickBestBackdrop } from "@/server/tmdb/client";

// Anything unrecognized (including missing) falls back to RELEASED rather than guessed at.
const MOVIE_STATUS_MAP: Record<string, MediaStatus> = {
	Rumored: MediaStatus.ANNOUNCED,
	Planned: MediaStatus.ANNOUNCED,
	"In Production": MediaStatus.UPCOMING,
	"Post Production": MediaStatus.UPCOMING,
	Released: MediaStatus.RELEASED,
};

function resolveMovieStatus(data: TmdbMovieResponse): MediaStatus {
	return MOVIE_STATUS_MAP[data.status] ?? MediaStatus.RELEASED;
}

// TMDB has no separate id space for shorts (plain movie entries), and rows can get reclassified to
// SHORT after creation, so lookups must match both types or risk duplicate creates / false 404s.
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
				isAdult: data.adult,
				overview: data.overview,
				externalId,
				releaseDate: data.release_date ? new Date(data.release_date) : null,
				status: resolveMovieStatus(data),
				publicRating: data.vote_average,
				posterPath: data.poster_path,
				bannerPath,
				countryId: country?.id ?? null,
				sourceUrl: `https://www.themoviedb.org/movie/${externalId}`,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				movie: {
					create: {
						runtime: data.runtime,
						budget: data.budget,
						revenue: data.revenue,
						tagline: data.tagline,
						imdbID: data.imdb_id,
						originalLanguage: data.original_language,
						popularity: data.popularity,
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

		// Only hits the images endpoint when a banner is still missing, since bulk re-enrichment runs over every row.
		const bannerPath =
			existing.bannerPath ??
			pickBestBackdrop(
				(await fetchTmdbImages(externalId, MediaType.MOVIE)).backdrops,
			) ??
			data.backdrop_path;

		// Re-enrichment only fills in still-empty fields; budget/revenue/publicRating/popularity/status
		// genuinely change over time at the source, so those always refresh.
		await tx.media.update({
			where: { id: existing.id },
			data: {
				title: existing.title ?? data.title,
				// TMDB's adult flag can turn this on but never off — it's unreliable in practice (only
				// true for hardcore listings), so a manual correction in the editor always wins.
				isAdult: existing.isAdult || data.adult,
				overview: existing.overview ?? data.overview,
				status: resolveMovieStatus(data),
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
						// Refreshed every re-enrich, not just filled in once (see media.prisma).
						popularity: data.popularity,
					},
				},
			},
		});

		await syncMovieCreditsAndGenres(tx, existing.id, data);

		return existing;
	});
}
