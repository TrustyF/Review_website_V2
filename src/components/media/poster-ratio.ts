import { MediaType } from "@prisma/client";

// TMDB covers are a normalized 2:3; ComicVine/IGDB are ~3:4. MangaDex covers vary per-title (sampled 40, clustered ~0.70-0.71), so 7/10 minimizes cropping better than 2:3 there.
//
// Kept out of poster.tsx: that file is "use client", and Next treats every export from a client module as client-only, so Server Components couldn't call it from there.
export function posterRatioFor(type: MediaType): string {
	if (type === MediaType.COMIC || type === MediaType.GAME) return "3/4";
	// if (type === MediaType.MANGA) return "7/10";
	return "2/3";
}
