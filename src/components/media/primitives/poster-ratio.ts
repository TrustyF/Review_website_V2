import { MediaType } from "@prisma/client";

// TMDB (movies/TV) covers are all a normalized CDN size, exactly 2:3 —
// measured from actual cached files, 500x750. ComicVine and IGDB's covers
// are also CDN-templated and noticeably squarer, close to 3:4 (716x960,
// 264x352). MangaDex covers are scanned print-book covers with real
// per-title variance instead of a normalized size — sampled 40 real cached
// covers and got a 0.631–0.739 spread, clustered around 0.70–0.71 (median
// 0.701), clearly off-center from 2:3 (0.667). No single ratio fits every
// manga cover exactly, but 7/10 sits on that cluster and minimizes cropping
// across the set better than reusing 2:3 does.
//
// Kept out of poster.tsx: that file is "use client", and Next treats every
// export from a client module as client-only — even a plain function like
// this one — so a Server Component (media-card-shell.tsx, page.tsx) can't
// call it directly from there.
export function posterRatioFor(type: MediaType): string {
	if (type === MediaType.COMIC || type === MediaType.GAME) return "3/4";
	// if (type === MediaType.MANGA) return "7/10";
	return "2/3";
}
