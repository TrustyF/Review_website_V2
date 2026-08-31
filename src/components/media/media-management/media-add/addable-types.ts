import { MediaType } from "@prisma/client";

// Types with a working search + create pipeline; SHORT is excluded since addMovieFromTmdb always creates a MOVIE.
// Kept out of media-add-actions.ts because "use server" files may only export async functions.
export const ADDABLE_TYPES = [
	MediaType.MOVIE,
	MediaType.TVSHOW,
	MediaType.MANGA,
	MediaType.COMIC,
	MediaType.GAME,
	MediaType.BOOK,
] as const;

export type AddableType = (typeof ADDABLE_TYPES)[number];

export type MediaSearchResult = {
	externalId: string;
	title: string;
	year: number | null;
	posterSrc: string | null;
};
