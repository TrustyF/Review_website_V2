"use server";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import {
	fetchTmdbById,
	fetchTmdbByName,
	fetchTvShowById,
	fetchTvShowByName,
} from "@/server/tmdb/client";
import { addMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { addTvShowFromTmdb } from "@/server/tmdb/ingest/tv-show";
import {
	fetchMangaDexById,
	fetchMangaDexStatistics,
	searchMangaDex,
} from "@/server/mangadex/client";
import { addMangaFromMangaDex } from "@/server/mangadex/ingest/manga";
import { pickEnglishTitle } from "@/server/mangadex/localized";
import { fetchIgdbGameById, searchIgdbGames } from "@/server/igdb/client";
import { addGameFromIgdb } from "@/server/igdb/ingest/game";
import { fetchComicVineById, searchComicVine } from "@/server/comicvine/client";
import { addComicFromComicVine } from "@/server/comicvine/ingest/comic";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";
import {
	AddableType,
	MediaSearchResult,
} from "@/components/media/media-add/addable-types";

function yearOf(dateString: string | null): number | null {
	if (!dateString) return null;
	const year = new Date(dateString).getFullYear();
	return Number.isFinite(year) ? year : null;
}

export async function searchMediaSources(
	type: AddableType,
	query: string,
): Promise<MediaSearchResult[]> {
	if (!query.trim()) return [];

	switch (type) {
		case MediaType.MOVIE: {
			const results = await fetchTmdbByName(query, MediaType.MOVIE, 1);
			return results.map((r) => ({
				externalId: String(r.id),
				title: r.title,
				year: yearOf(r.release_date),
				posterSrc: r.poster_path
					? buildProxiedImageUrl(
							`https://image.tmdb.org/t/p/w154${r.poster_path}`,
						)
					: null,
			}));
		}
		case MediaType.TVSHOW: {
			const results = await fetchTvShowByName(query, 1);
			return results.map((r) => ({
				externalId: String(r.id),
				title: r.name,
				year: yearOf(r.first_air_date),
				posterSrc: r.poster_path
					? buildProxiedImageUrl(
							`https://image.tmdb.org/t/p/w154${r.poster_path}`,
						)
					: null,
			}));
		}
		case MediaType.MANGA: {
			const results = await searchMangaDex(query);
			return results.map((r) => {
				const fileName = r.relationships.find((rel) => rel.type === "cover_art")
					?.attributes?.fileName;
				return {
					externalId: r.id,
					title:
						pickEnglishTitle(r.attributes.title, r.attributes.altTitles) ??
						"Untitled",
					year: r.attributes.year,
					posterSrc: fileName
						? buildProxiedImageUrl(
								`https://uploads.mangadex.org/covers/${r.id}/${fileName}.256.jpg`,
							)
						: null,
				};
			});
		}
		case MediaType.GAME: {
			const results = await searchIgdbGames(query);
			return results.map((r) => ({
				externalId: String(r.id),
				title: r.name,
				year: r.first_release_date
					? new Date(r.first_release_date * 1000).getFullYear()
					: null,
				posterSrc: r.cover?.image_id
					? buildProxiedImageUrl(
							`https://images.igdb.com/igdb/image/upload/t_cover_small/${r.cover.image_id}.jpg`,
						)
					: null,
			}));
		}
		case MediaType.COMIC: {
			const results = await searchComicVine(query);
			return results.map((r) => ({
				externalId: String(r.id),
				title: r.name,
				year: r.start_year ? Number(r.start_year) : null,
				posterSrc:
					r.image?.small_url || r.image?.medium_url
						? buildProxiedImageUrl((r.image?.small_url ?? r.image?.medium_url)!)
						: null,
			}));
		}
	}
}

export async function addMediaToLibrary(
	type: AddableType,
	externalId: string,
): Promise<number> {
	let mediaId: number;

	switch (type) {
		case MediaType.MOVIE: {
			const data = await fetchTmdbById(externalId, MediaType.MOVIE);
			mediaId = (await addMovieFromTmdb(data)).id;
			break;
		}
		case MediaType.TVSHOW: {
			const data = await fetchTvShowById(externalId);
			mediaId = (await addTvShowFromTmdb(data)).id;
			break;
		}
		case MediaType.MANGA: {
			const data = await fetchMangaDexById(externalId);
			const statistics = await fetchMangaDexStatistics(externalId);
			mediaId = (await addMangaFromMangaDex(data, statistics)).id;
			break;
		}
		case MediaType.GAME: {
			const data = await fetchIgdbGameById(externalId);
			mediaId = (await addGameFromIgdb(data)).id;
			break;
		}
		case MediaType.COMIC: {
			const data = await fetchComicVineById(externalId);
			mediaId = (await addComicFromComicVine(data)).id;
			break;
		}
	}

	revalidatePath("/");
	return mediaId;
}
