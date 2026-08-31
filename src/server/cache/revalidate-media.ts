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

// Scoped to just the surfaces a media item can appear on — revalidatePath("/", "layout") would purge the whole site's ISR cache and blew through Vercel's write quota.
export function revalidateMediaPaths(mediaId: number, type: MediaType) {
	revalidatePath(`/media/${mediaId}`);
	revalidatePath(CATALOG_PATH[type]);
	if (type === MediaType.MOVIE) revalidatePath("/movies/recent");
	revalidatePath("/");
	revalidatePath("/reviews");
	// Refreshes the unstable_cache-wrapped media queries sharing this tag; updateTag (not revalidateTag) so the editing admin sees the change immediately.
	updateTag(mediaCacheTag(mediaId));
}
