import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";

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
}
