import { createHash } from "crypto";
import { MediaType } from "@prisma/client";

// Pure "given a stored path, what's the URL/filename" helpers split out of
// poster-resolver.ts — that file also pulls in `sharp` (a native addon) for
// its actual resolve*() functions, which are only ever called from the
// handful of routes/actions that do real image work (the /api/poster,
// /api/banner, /api/person-photo, /api/link-embed routes, and the editor
// save path). Everything here has no such dependency, so any server action
// that only needs to build a URL — search-actions.ts, list-actions.ts,
// media/types.ts's RawMediaRecord mapping, etc. — can import straight from
// this module and skip loading sharp's native binary on every cold
// invocation. poster-resolver.ts still re-exports all of this for existing
// callers that also need its sharp-backed resolve*() functions.

// Every *_DIR constant below is a logical key handed to ImageStorage, not a
// real filesystem path — see src/server/storage/image-storage.ts. Local
// storage joins it onto public/ itself; a remote backend would use it as a
// key prefix instead.
export const POSTER_DIR = "posters/cache";

// Separate from POSTER_DIR: change log thumbnails are deliberately the
// smallest size each source offers (see poster-resolver.ts's
// smallSourceUrlFor equivalent) rather than the main poster's w500-equivalent,
// so they get their own cache directory instead of colliding on the same
// filename with a different-sized file.
export const CHANGELOG_THUMB_DIR = "posters/changelog-cache";

// Separate again from the two above: banners are a different asset (wide
// backdrop/artwork, not a poster) with their own cache, even though they
// share every other bit of machinery.
export const BANNER_DIR = "banners/cache";

// Change log's own banner thumbnail cache — same reasoning as
// CHANGELOG_THUMB_DIR vs POSTER_DIR: a different size than BANNER_DIR, own
// directory rather than risk colliding on a same-hash-different-size file.
export const CHANGELOG_BANNER_THUMB_DIR = "banners/changelog-cache";

// Cast headshot cache — keyed by personId rather than mediaId (nothing about
// mediaAssetFilename's numeric-prefix-plus-hash scheme is actually
// media-specific), since a person's photo is the same asset across every
// media they're credited on.
export const PERSON_PHOTO_DIR = "people/photo-cache";

// A JPEG-specific cache purely for the og:image tag a shared link's preview
// card reads (see poster-resolver.ts's resolveLinkEmbedImage) — separate
// from POSTER_DIR because the main poster cache is deliberately WebP, but
// Discord/WhatsApp's link-preview crawlers need JPEG/PNG reliably.
export const LINK_EMBED_DIR = "posters/link-embed-cache";

// Largest a person photo renders at today is the credits page sidebar,
// 150px CSS width (300px at 2x DPI) — see poster-resolver.ts's
// resolvePersonPhoto for the resize this bounds.
export const PERSON_PHOTO_MAX_WIDTH = 300;
export const PERSON_PHOTO_QUALITY = 50;

// The page's own content column tops out at 950px — a banner never renders
// any wider than that, so caching TMDB's 1280px backdrops or IGDB's
// up-to-1920px artworks at full size was pure waste. See poster-resolver.ts's
// resolveBanner for the resize this bounds.
export const BANNER_MAX_WIDTH = 1280;
// Tuned in the banner compression dev tool (/dev/banner-compression) against
// real TMDB/IGDB banners. Changing either requires updating every place that
// assumes BANNER_FORMAT's extension: mediaAssetFilename's "avif" argument,
// cleanup-posters.ts (orphan filenames), and the Content-Type in the
// /api/banner route.
export const BANNER_FORMAT = "avif";
export const BANNER_QUALITY = 60;
// Decorative only — a CSS mix-blend-mode overlay applied where a banner is
// actually displayed, never baked into the cached file itself.
export const BANNER_GRAIN_OPACITY = 0.5;
// The main poster cache re-encodes to WebP at this quality and keeps the
// source's own dimensions — see poster-resolver.ts's resolvePoster.
export const POSTER_QUALITY = 50;

export type CacheFormat = "webp" | "avif" | "jpeg";

// Content-addressable: the filename is derived from the source path itself
// (posterPath or bannerPath), so switching a media's poster/banner naturally
// produces a different filename/URL — no cache-busting query string or
// manual invalidation needed. Old files from a previous path become
// orphaned; see poster-cleanup.ts (main posters) and
// purge-deleted-change-log.ts (change log thumbnails).
// extension must match whatever poster-resolver.ts's cacheOrDownload
// actually encoded to for that asset (see BANNER_FORMAT) — every caller of
// this function is independently guessing the filename an earlier
// resolve*/cache write produced, not reading it off disk.
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

// The lazy-resolve poster URL for a media item — points at /api/poster,
// which does the actual resolve-or-download the moment something requests
// it (see poster-resolver.ts), or the static placeholder when there's no
// poster at all. Was copy-pasted identically in list-actions.ts's
// searchMediaForList and search-actions.ts's searchAllMedia; both build
// search results shaped around a MediaRecord-like {id, posterPath}, so this
// is the one place that ternary needs to live.
export function toPosterSrc(mediaId: number, posterPath: string | null) {
	return posterPath
		? `/api/poster/${mediaId}/${mediaAssetFilename(mediaId, posterPath)}`
		: "/posters/placeholder.jpg";
}

export type PosterSize = "thumb" | "full";

// The one place that knows how to turn a stored posterPath into an actual
// CDN URL — used for the main poster cache, the change log thumbnail cache,
// the editor's alternate-poster picker, and add-media's search-result
// thumbnails, so a source's URL template only ever needs to change here.
//
// Each source stores posterPath differently: TMDB's is a path segment
// appended to its image CDN, MangaDex's is just a cover filename that needs
// the manga's own id (externalId) to locate on its upload host, IGDB's is an
// image_id that slots into its own CDN path template. ComicVine and manually
// entered posters are already full URLs, with nothing left to template —
// checked first, ahead of and independent of type, since a manual entry can
// be any MediaType.
//
// "thumb" vs "full" only matters for the three templated sources — a
// ComicVine/manual posterPath is a fixed URL either way. Callers that want a
// smaller size than "thumb" gives (e.g. the change log's 46x69 display) rely
// on poster-resolver.ts's resolveChangelogPosterThumb's own resize instead
// of a third tier here.
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
		// .512.jpg is MangaDex's downsized thumbnail rather than the
		// full-resolution scan (often several MB); .256.jpg is smaller still.
		return `https://uploads.mangadex.org/covers/${externalId}/${posterPath}.${size === "full" ? "512" : "256"}.jpg`;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_cover_${size === "full" ? "big" : "small"}/${posterPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/${size === "full" ? "w500" : "w154"}${posterPath}`;
}

// The composite depends on both the poster and (when there is one) the
// banner, so both need to be part of the content-address — shared between
// toLinkEmbedImageSrc and poster-resolver.ts's resolveLinkEmbedImage so they
// can never compute different filenames for the same inputs.
export function linkEmbedCacheKey(posterPath: string, bannerPath: string | null) {
	return `${posterPath}::${bannerPath ?? ""}`;
}

// The lazy-resolve URL counterpart to poster-resolver.ts's
// resolveLinkEmbedImage, same shape as toPosterSrc — points at
// /api/link-embed, which resolves-or-downloads the moment a link-preview
// crawler actually requests it. Returns null (not a placeholder) when
// there's no real poster — a generic placeholder image on a preview card
// would misrepresent the title rather than just show nothing.
export function toLinkEmbedImageSrc(
	mediaId: number,
	posterPath: string | null,
	bannerPath: string | null,
) {
	return posterPath
		? `/api/link-embed/${mediaId}/${mediaAssetFilename(mediaId, linkEmbedCacheKey(posterPath, bannerPath), "jpeg")}`
		: null;
}

// Only TMDB (backdrop_path) and IGDB (artworks) have a wide banner asset at
// all — MangaDex/ComicVine/manual entries never populate Media.bannerPath in
// the first place, so this never actually needs to handle those. No
// externalId parameter: unlike posterUrlFor, neither TMDB's backdrop_path
// nor IGDB's artwork image_id need scoping context to locate.
export function bannerUrlFor(type: MediaType, bannerPath: string) {
	if (bannerPath.startsWith("http://") || bannerPath.startsWith("https://")) {
		return bannerPath;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_1080p/${bannerPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/w1280${bannerPath}`;
}

// Only TMDB cast credits ever populate Person.photoPath — no per-source
// branching needed, same as companyLogoUrlFor. w300 is TMDB's next profile
// size up from w185 — needed so poster-resolver.ts's resolvePersonPhoto's
// own resize to PERSON_PHOTO_MAX_WIDTH (300) isn't just upscaling an
// already-too-small source.
export function personPhotoUrlFor(photoPath: string): string {
	if (photoPath.startsWith("http://") || photoPath.startsWith("https://")) {
		return photoPath;
	}
	return `https://image.tmdb.org/t/p/w300${photoPath}`;
}

// The lazy-resolve URL counterpart to poster-resolver.ts's
// resolvePersonPhoto, same shape as toPosterSrc — points at
// /api/person-photo, which resolves-or-downloads the moment a browser
// actually requests it. Returns null (not a placeholder) when there's no
// photo — CastPhotos falls back to a plain text link in that case rather
// than rendering a generic avatar.
export function toPersonPhotoSrc(personId: number, photoPath: string | null) {
	return photoPath
		? `/api/person-photo/${personId}/${mediaAssetFilename(personId, photoPath)}`
		: null;
}
