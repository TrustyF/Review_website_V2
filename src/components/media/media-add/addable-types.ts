import { MediaType } from "@prisma/client";

// The types a media item can actually be searched for and added as — the
// only ones with a working search + create pipeline. SHORT shares TMDB's
// movie endpoint but has no dedicated add path (addMovieFromTmdb always
// creates a MOVIE).
//
// Kept out of media-add-actions.ts: a "use server" file may only export
// async functions, so a plain array/type export there breaks when a client
// component imports it (surfaces as "ADDABLE_TYPES.map is not a function").
export const ADDABLE_TYPES = [
	MediaType.MOVIE,
	MediaType.TVSHOW,
	MediaType.MANGA,
	MediaType.COMIC,
	MediaType.GAME,
] as const;

export type AddableType = (typeof ADDABLE_TYPES)[number];

export type MediaSearchResult = {
	externalId: string;
	title: string;
	year: number | null;
	posterSrc: string | null;
};
