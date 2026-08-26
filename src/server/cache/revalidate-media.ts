import { revalidatePath, updateTag } from "next/cache";
import { MediaType } from "@prisma/client";
import { mediaCacheTag } from "./media-cache-tag";

const CATALOG_PATH: Record<MediaType, string> = {
	MOVIE: "/movies",
	SHORT: "/shorts",
	TVSHOW: "/tv",
	MANGA: "/manga",
	COMIC: "/comics",
	GAME: "/games",
	BOOK: "/books",
};

// Every public surface a single media item can appear on: its own detail
// page, its type's catalog list, and the cross-type feeds on the homepage
// and /reviews. Scoped on purpose — revalidatePath("/", "layout") purges
// the ISR cache for the *entire* site (every route under the root layout,
// per next/cache's own "Revalidating all data" example), so calling it from
// a routine edit (or a debounced slider, see updateMediaBannerFocus) means
// every subsequent visit to any page anywhere regenerates, which is what
// was blowing through Vercel's ISR write quota. This hits only what could
// actually have changed.
export function revalidateMediaPaths(mediaId: number, type: MediaType) {
	revalidatePath(`/media/${mediaId}`);
	revalidatePath(CATALOG_PATH[type]);
	if (type === MediaType.MOVIE) revalidatePath("/movies/recent");
	revalidatePath("/");
	revalidatePath("/reviews");
	// /media/[id] itself is dynamic (auth() forces it), but the three
	// getMediaCore/getMediaCredits/getMediaChangeLog queries it reads (see
	// get-media.ts) are unstable_cache-wrapped and share this one tag, so a
	// single call here also refreshes those instead of just the route's own
	// (largely inert) full-page cache entry. updateTag (not revalidateTag)
	// since every caller of this function is itself a Server Action — the
	// admin who just made the edit should see it immediately, not
	// stale-while-revalidate.
	updateTag(mediaCacheTag(mediaId));
}
