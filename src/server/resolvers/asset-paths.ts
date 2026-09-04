import { createHash } from "crypto";
import { MediaType } from "@prisma/client";

// Pure URL/filename helpers split out of poster-resolver.ts so callers that only need a URL (search-actions.ts, list-actions.ts, ...) skip loading sharp's native binary.

// Logical keys handed to ImageStorage, not real filesystem paths — local storage joins onto public/, a remote backend uses it as a key prefix.
export const POSTER_DIR = "posters/cache";

// Own directory since changelog thumbnails are a smaller size than the main poster, avoiding a same-hash-different-size collision.
export const CHANGELOG_THUMB_DIR = "posters/changelog-cache";

export const BANNER_DIR = "banners/cache";

// Own directory, same reasoning as CHANGELOG_THUMB_DIR vs POSTER_DIR.
export const CHANGELOG_BANNER_THUMB_DIR = "banners/changelog-cache";

// Keyed by personId (not mediaId) since a person's photo is shared across every media they're credited on.
export const PERSON_PHOTO_DIR = "people/photo-cache";

// Separate JPEG cache for og:image previews — the main poster cache is WebP, but link-preview crawlers need JPEG/PNG reliably.
export const LINK_EMBED_DIR = "posters/link-embed-cache";

// Bounds resolvePersonPhoto's resize — largest render today is the credits sidebar, 150px CSS (300px at 2x DPI).
export const PERSON_PHOTO_MAX_WIDTH = 300;
export const PERSON_PHOTO_QUALITY = 50;

// Bounds resolveBanner's resize — the content column tops out at 950px, so caching full-size TMDB/IGDB backdrops is wasted.
export const BANNER_MAX_WIDTH = 1280;
// Tuned in /dev/banner-compression. Changing the format requires updating mediaAssetFilename's extension, cleanup-posters.ts, and /api/banner's Content-Type.
export const BANNER_FORMAT = "avif";
export const BANNER_QUALITY = 60;
// Decorative CSS mix-blend-mode overlay, never baked into the cached file.
export const BANNER_GRAIN_OPACITY = 0.5;
export const POSTER_QUALITY = 50;

// Own directory/format from BANNER_DIR's avif cache — the weekly digest's
// hero banner needs a format mail clients can actually render (Outlook/many
// webmail clients don't support AVIF), and a smaller width since it's
// rendered at ~600px CSS wide, not the site's full content column.
export const EMAIL_BANNER_DIR = "banners/email-cache";
export const EMAIL_BANNER_MAX_WIDTH = 900;
export const EMAIL_BANNER_QUALITY = 65;

export type CacheFormat = "webp" | "avif" | "jpeg";

// Content-addressable: derived from the source path so switching a poster/banner naturally produces a new filename, no cache-busting needed. Old files become orphaned (see cleanup-posters.ts / purge-deleted-change-log.ts).
// extension must match whatever cacheOrDownload actually encoded to for that asset — callers are guessing the filename, not reading it off disk.
export function mediaAssetFilename(
	mediaId: number,
	assetPath: string,
	extension: CacheFormat = "webp",
) {
	const hash = createHash("sha256")
		.update(assetPath)
		.digest("hex")
		.slice(0, 12);
	return `${mediaId}-${hash}.${extension}`;
}

// Lazy-resolve poster URL, points at /api/poster (which resolves-or-downloads on request) or a placeholder. Centralized here to avoid duplicating this ternary in list/search actions.
export function toPosterSrc(mediaId: number, posterPath: string | null) {
	return posterPath
		? `/api/poster/${mediaId}/${mediaAssetFilename(mediaId, posterPath)}`
		: "/posters/placeholder.jpg";
}

export type PosterSize = "thumb" | "full";

// Single place that turns a stored posterPath into a CDN URL so a source's URL template only changes here.
// Each source stores posterPath differently (TMDB path segment, MangaDex filename keyed by externalId, IGDB image_id); ComicVine/manual entries are already full URLs, checked first regardless of type.
// "thumb"/"full" only matters for the templated sources; anything smaller relies on resolveChangelogPosterThumb's own resize instead of a third tier.
export function posterUrlFor(
	type: MediaType,
	externalId: string | null,
	posterPath: string,
	size: PosterSize,
) {
	if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
		return posterPath;
	}
	if (type === MediaType.MANGA) {
		// .512.jpg is MangaDex's downsized thumbnail, not the full-res scan; .256.jpg is smaller still.
		return `https://uploads.mangadex.org/covers/${externalId}/${posterPath}.${size === "full" ? "512" : "256"}.jpg`;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_cover_${size === "full" ? "big" : "small"}/${posterPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/${size === "full" ? "w500" : "w154"}${posterPath}`;
}

// Lazy-resolve counterpart to resolveLinkEmbedImage. Returns null (not a placeholder) when there's no poster, since a generic image would misrepresent the title on a preview card.
export function toLinkEmbedImageSrc(mediaId: number, posterPath: string | null) {
	return posterPath
		? `/api/link-embed/${mediaId}/${mediaAssetFilename(mediaId, posterPath, "jpeg")}`
		: null;
}

// Only TMDB/IGDB populate Media.bannerPath, so no other sources to handle. No externalId param needed, unlike posterUrlFor — neither source's path needs scoping context.
export function bannerUrlFor(type: MediaType, bannerPath: string) {
	if (bannerPath.startsWith("http://") || bannerPath.startsWith("https://")) {
		return bannerPath;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_1080p/${bannerPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/w1280${bannerPath}`;
}

// Only TMDB populates Person.photoPath, no per-source branching needed. w300 (not w185) so resolvePersonPhoto's resize to 300px isn't upscaling an already-too-small source.
export function personPhotoUrlFor(photoPath: string): string {
	if (photoPath.startsWith("http://") || photoPath.startsWith("https://")) {
		return photoPath;
	}
	return `https://image.tmdb.org/t/p/w300${photoPath}`;
}

// Lazy-resolve counterpart to resolvePersonPhoto. Returns null when there's no photo — CastPhotos falls back to a plain text link rather than a generic avatar.
export function toPersonPhotoSrc(personId: number, photoPath: string | null) {
	return photoPath
		? `/api/person-photo/${personId}/${mediaAssetFilename(personId, photoPath)}`
		: null;
}
