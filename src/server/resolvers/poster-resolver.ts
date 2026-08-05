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
// Both the main poster cache and the change log thumbnail cache re-encode
// to WebP at this quality — the main poster keeps its source dimensions
// (it's the one place a larger image is actually wanted), only the
// thumbnail also gets resized.
const WEBP_QUALITY = 75;

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

// Content-addressable: the filename is derived from posterPath itself, so
// switching a media's poster naturally produces a different filename/URL —
// no cache-busting query string or manual invalidation needed. Old files
// from a previous posterPath become orphaned; see poster-cleanup.ts (main
// posters) and purge-deleted-change-log.ts (change log thumbnails).
export function posterFilename(mediaId: number, posterPath: string) {
	const hash = createHash("sha256")
		.update(posterPath)
		.digest("hex")
		.slice(0, 12);
	return `${mediaId}-${hash}.webp`;
}

// Each source stores posterPath differently: TMDB's is a path segment
// appended to its image CDN, MangaDex's is just a cover filename that needs
// the manga's own id (externalId) to locate on its upload host, IGDB's is an
// image_id that slots into its own CDN path template. ComicVine and manually
// entered posters (see manual-add-actions.ts) are already full URLs, with
// nothing left to template — checked first, ahead of and independent of
// type, since a manual entry can be any MediaType.
export function sourceUrlFor(type: MediaType, externalId: string, posterPath: string) {
	if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
		return posterPath;
	}
	if (type === MediaType.MANGA) {
		// .512.jpg requests MangaDex's downsized thumbnail instead of the
		// full-resolution scan (often several MB), mirroring TMDB's w500.
		return `https://uploads.mangadex.org/covers/${externalId}/${posterPath}.512.jpg`;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_cover_big/${posterPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

// Smallest size each source will template — used only for change log
// thumbnails (rendered at 46x69), where the main poster's w500-equivalent
// would be needlessly large. ComicVine/manual posterPaths are already a
// full URL with nothing left to template (see sourceUrlFor), so there's no
// smaller variant to ask for — same URL as the main poster in that case.
export function smallSourceUrlFor(
	type: MediaType,
	externalId: string,
	posterPath: string,
) {
	if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
		return posterPath;
	}
	if (type === MediaType.MANGA) {
		return `https://uploads.mangadex.org/covers/${externalId}/${posterPath}.256.jpg`;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_cover_small/${posterPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/w92${posterPath}`;
}

// Shared by resolvePoster and resolveChangelogPosterThumb: content-addressed
// cache-or-download, differing only in directory, which size URL to fetch,
// and whether the downloaded bytes get resized down before being written —
// both re-encode to WebP.
async function cacheOrDownload(
	dir: string,
	filename: string,
	sourceUrl: string,
	{ resize = false }: { resize?: boolean } = {},
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
			image = image.resize({ height: THUMB_MAX_HEIGHT, withoutEnlargement: true });
		}
		const output = await image.webp({ quality: WEBP_QUALITY }).toBuffer();
		await writeFile(filePath, output);
	}

	return filePath;
}

export async function resolvePoster(
	mediaId: number,
	type: MediaType,
	externalId: string,
	posterPath: string | null,
) {
	if (!posterPath) return "/posters/placeholder.jpg";

	const filename = posterFilename(mediaId, posterPath);
	await cacheOrDownload(POSTER_DIR, filename, sourceUrlFor(type, externalId, posterPath));

	return `/posters/cache/${filename}`;
}

// Same content-addressable caching as resolvePoster, but for a change log
// entry's old/new posterPath — mediaId + posterPath alone is enough to
// address it, so a poster that's since been replaced (or a media that's
// since been deleted) still resolves to its own stable historical file.
export async function resolveChangelogPosterThumb(
	mediaId: number,
	type: MediaType,
	externalId: string,
	posterPath: string,
) {
	const filename = posterFilename(mediaId, posterPath);
	await cacheOrDownload(
		CHANGELOG_THUMB_DIR,
		filename,
		smallSourceUrlFor(type, externalId, posterPath),
		{ resize: true },
	);

	return `/posters/changelog-cache/${filename}`;
}
