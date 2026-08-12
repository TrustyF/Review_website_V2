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
import { fetchGoogleBooksById, searchGoogleBooks } from "@/server/google-books/client";
import { addBookFromGoogleBooks, upgradeToHttps } from "@/server/google-books/ingest/book";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";
import { posterUrlFor } from "@/server/resolvers/poster-resolver";
import {
	AddableType,
	MediaSearchResult,
} from "@/components/media/media-management/media-add/addable-types";
import { requireAdmin } from "@/lib/auth/require-admin";

function yearOf(dateString: string | null): number | null {
	if (!dateString) return null;
	const year = new Date(dateString).getFullYear();
	return Number.isFinite(year) ? year : null;
}

// Google Books' publishedDate is often a bare year ("1997") rather than a
// full date — new Date("1997").getFullYear() misparses that (off by one in
// UTC-negative timezones), so the year is read directly off the string
// instead of round-tripping through Date.
function bookYearOf(publishedDate: string | null | undefined): number | null {
	const match = publishedDate?.match(/^\d{4}/);
	return match ? Number(match[0]) : null;
}

export async function searchMediaSources(
	type: AddableType,
	query: string,
): Promise<MediaSearchResult[]> {
	await requireAdmin();
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
							posterUrlFor(MediaType.MOVIE, String(r.id), r.poster_path, "thumb"),
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
							posterUrlFor(MediaType.TVSHOW, String(r.id), r.poster_path, "thumb"),
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
								posterUrlFor(MediaType.MANGA, r.id, fileName, "thumb"),
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
							posterUrlFor(MediaType.GAME, String(r.id), r.cover.image_id, "thumb"),
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
		case MediaType.BOOK: {
			const results = await searchGoogleBooks(query);
			return results.map((r) => ({
				externalId: r.id,
				title: r.volumeInfo.title,
				year: bookYearOf(r.volumeInfo.publishedDate),
				posterSrc: r.volumeInfo.imageLinks?.thumbnail
					? buildProxiedImageUrl(upgradeToHttps(r.volumeInfo.imageLinks.thumbnail))
					: null,
			}));
		}
	}
}

export async function addMediaToLibrary(
	type: AddableType,
	externalId: string,
): Promise<number> {
	await requireAdmin();
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
			const [data, statistics] = await Promise.all([
				fetchMangaDexById(externalId),
				fetchMangaDexStatistics(externalId),
			]);
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
		case MediaType.BOOK: {
			const data = await fetchGoogleBooksById(externalId);
			mediaId = (await addBookFromGoogleBooks(data)).id;
			break;
		}
	}

	// "layout" (not just "/") — a plain revalidatePath("/") only invalidated
	// the homepage itself, leaving every per-type list page (/movies, /tv,
	// ...) and the new item's own /media/[id] serving a stale cached render
	// until something unrelated happened to touch that specific path later.
	// Root path + "layout" invalidates every route nested under the root
	// layout — i.e. the whole site — and also purges the client Router
	// Cache, per next/cache's own "Revalidating all data" pattern.
	revalidatePath("/", "layout");
	return mediaId;
}
