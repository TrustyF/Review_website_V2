import { access, mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import sharp from "sharp";
import { MediaType } from "@prisma/client";

// The change log thumbnail only ever displays at 46x69 CSS px (~138px tall
// at 2x DPI) — smallSourceUrlFor already asks each source for its smallest
// templated size, but ComicVine and manually-entered posters have no
// smaller variant to request (see sourceUrlFor) and can come back at full
// poster resolution. Re-encoding to this height regardless of source
// guarantees a small cached file either way, instead of only when the
// source happens to cooperate.
const THUMB_MAX_HEIGHT = 140;
// The page's own content column tops out at 950px (see media-detail.module
// .sass .wrapper) — a banner never renders any wider than that, so caching
// TMDB's 1280px backdrops or IGDB's up-to-1920px artworks at full size was
// pure waste. Measured against 12 real banners: capping width alone (still
// at WEBP_QUALITY) cut total size 45%, the large majority of what's
// possible — quality has much less room to give without visibly softening
// an image shown this large. See resolveBanner.
// Exported (unlike the other size/quality constants here) so the banner
// compression dev tool can show "what production actually does today" as a
// baseline alongside whatever it's experimenting with, instead of a
// hardcoded number that could silently drift out of sync with this file.
export const BANNER_MAX_WIDTH = 1280;
export const BANNER_WEBP_QUALITY = 90;
// Change log rows show a small landscape thumbnail for a bannerPath change,
// the same idea as THUMB_MAX_HEIGHT for posterPath — sized down from
// BANNER_MAX_WIDTH the same way THUMB_MAX_HEIGHT is sized down from the full
// poster. See resolveChangelogBannerThumb.
const BANNER_THUMB_MAX_WIDTH = 120;
// Both the main poster cache and the change log thumbnail cache re-encode
// to WebP at this quality — the main poster keeps its source dimensions
// (it's the one place a larger image is actually wanted), only the
// thumbnail and banner also get resized.

export const POSTER_DIR = path.join(
	process.cwd(),
	"public",
	"posters",
	"cache",
);

// Separate from POSTER_DIR: change log thumbnails are deliberately the
// smallest size each source offers (see smallSourceUrlFor) rather than the
// main poster's w500-equivalent, so they get their own cache directory
// instead of colliding on the same filename with a different-sized file.
export const CHANGELOG_THUMB_DIR = path.join(
	process.cwd(),
	"public",
	"posters",
	"changelog-cache",
);

// Separate again from the two above: banners are a different asset (wide
// backdrop/artwork, not a poster) with their own cache, even though they
// share every other bit of machinery in this file.
export const BANNER_DIR = path.join(
	process.cwd(),
	"public",
	"banners",
	"cache",
);

// Change log's own banner thumbnail cache — same reasoning as
// CHANGELOG_THUMB_DIR vs POSTER_DIR: a different size than BANNER_DIR, own
// directory rather than risk colliding on a same-hash-different-size file.
export const CHANGELOG_BANNER_THUMB_DIR = path.join(
	process.cwd(),
	"public",
	"banners",
	"changelog-cache",
);

// Content-addressable: the filename is derived from the source path itself
// (posterPath or bannerPath), so switching a media's poster/banner naturally
// produces a different filename/URL — no cache-busting query string or
// manual invalidation needed. Old files from a previous path become
// orphaned; see poster-cleanup.ts (main posters) and
// purge-deleted-change-log.ts (change log thumbnails).
export function mediaAssetFilename(mediaId: number, assetPath: string) {
	const hash = createHash("sha256")
		.update(assetPath)
		.digest("hex")
		.slice(0, 12);
	return `${mediaId}-${hash}.webp`;
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
// entered posters (see manual-add-actions.ts) are already full URLs, with
// nothing left to template — checked first, ahead of and independent of
// type, since a manual entry can be any MediaType.
//
// "thumb" vs "full" only matters for the three templated sources — a
// ComicVine/manual posterPath is a fixed URL either way. Callers that want a
// smaller size than "thumb" gives (e.g. the change log's 46x69 display) rely
// on resolveChangelogPosterThumb's own resize instead of a third tier here.
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

// Shared by resolvePoster, resolveChangelogPosterThumb, and resolveBanner:
// content-addressed cache-or-download, differing only in directory, which
// size URL to fetch, and whether/how the downloaded bytes get resized down
// before being written — all three re-encode to WebP.
async function cacheOrDownload(
	dir: string,
	filename: string,
	sourceUrl: string,
	{ resize }: { resize?: { width?: number; height?: number } } = {},
	webpQuality = 75,
) {
	const filePath = path.join(dir, filename);

	try {
		await access(filePath);
	} catch {
		await mkdir(dir, { recursive: true });
		const res = await fetch(sourceUrl);
		if (!res.ok) throw new Error("Poster download failed");
		const bytes = Buffer.from(await res.arrayBuffer());
		let image = sharp(bytes);
		if (resize) {
			image = image.resize({ ...resize, withoutEnlargement: true });
		}
		const output = await image.webp({ quality: webpQuality }).toBuffer();
		await writeFile(filePath, output);
	}

	return filePath;
}

export async function resolvePoster(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string | null,
) {
	if (!posterPath) return "/posters/placeholder.jpg";

	const filename = mediaAssetFilename(mediaId, posterPath);
	await cacheOrDownload(
		POSTER_DIR,
		filename,
		posterUrlFor(type, externalId, posterPath, "full"),
	);

	return `/posters/cache/${filename}`;
}

// Same content-addressable caching as resolvePoster, but for a change log
// entry's old/new posterPath — mediaId + posterPath alone is enough to
// address it, so a poster that's since been replaced (or a media that's
// since been deleted) still resolves to its own stable historical file.
export async function resolveChangelogPosterThumb(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string,
) {
	const filename = mediaAssetFilename(mediaId, posterPath);
	await cacheOrDownload(
		CHANGELOG_THUMB_DIR,
		filename,
		posterUrlFor(type, externalId, posterPath, "thumb"),
		{ resize: { height: THUMB_MAX_HEIGHT } },
		50,
	);

	return `/posters/changelog-cache/${filename}`;
}

// Only TMDB (backdrop_path) and IGDB (artworks) have a wide banner asset at
// all — MangaDex/ComicVine/manual entries never populate Media.bannerPath in
// the first place (see the ingest files), so this never actually needs to
// handle those. No externalId parameter: unlike posterUrlFor, neither TMDB's
// backdrop_path nor IGDB's artwork image_id need scoping context to locate.
export function bannerUrlFor(type: MediaType, bannerPath: string) {
	if (bannerPath.startsWith("http://") || bannerPath.startsWith("https://")) {
		return bannerPath;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_1080p/${bannerPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/w1280${bannerPath}`;
}

// Same content-addressable cache-or-download as resolvePoster, own directory
// (BANNER_DIR) since it's a different asset. Capped to BANNER_MAX_WIDTH —
// the source is already display-ready otherwise, it's just wider than the
// page ever renders it.
export async function resolveBanner(
	mediaId: number,
	type: MediaType,
	bannerPath: string | null,
) {
	if (!bannerPath) return null;

	const filename = mediaAssetFilename(mediaId, bannerPath);
	await cacheOrDownload(
		BANNER_DIR,
		filename,
		bannerUrlFor(type, bannerPath),
		{ resize: { width: BANNER_MAX_WIDTH } },
		BANNER_WEBP_QUALITY,
	);

	return `/banners/cache/${filename}`;
}

// Same content-addressable caching as resolveChangelogPosterThumb, but for a
// change log entry's old/new bannerPath.
export async function resolveChangelogBannerThumb(
	mediaId: number,
	type: MediaType,
	bannerPath: string,
) {
	const filename = mediaAssetFilename(mediaId, bannerPath);
	await cacheOrDownload(
		CHANGELOG_BANNER_THUMB_DIR,
		filename,
		bannerUrlFor(type, bannerPath),
		{ resize: { width: BANNER_THUMB_MAX_WIDTH } },
		50,
	);

	return `/banners/changelog-cache/${filename}`;
}
