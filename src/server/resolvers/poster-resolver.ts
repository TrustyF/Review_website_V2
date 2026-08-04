import { access, mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { MediaType } from "@prisma/client";

export const POSTER_DIR = path.join(
	process.cwd(),
	"public",
	"posters",
	"cache",
);

// Content-addressable: the filename is derived from posterPath itself, so
// switching a media's poster naturally produces a different filename/URL —
// no cache-busting query string or manual invalidation needed. Old files
// from a previous posterPath become orphaned; see poster-cleanup.ts.
export function posterFilename(mediaId: number, posterPath: string) {
	const hash = createHash("sha256")
		.update(posterPath)
		.digest("hex")
		.slice(0, 12);
	return `${mediaId}-${hash}.jpg`;
}

// Each source stores posterPath differently: TMDB's is a path segment
// appended to its image CDN, MangaDex's is just a cover filename that needs
// the manga's own id (externalId) to locate on its upload host, IGDB's is an
// image_id that slots into its own CDN path template. ComicVine and manually
// entered posters (see manual-add-actions.ts) are already full URLs, with
// nothing left to template — checked first, ahead of and independent of
// type, since a manual entry can be any MediaType.
function sourceUrlFor(type: MediaType, externalId: string, posterPath: string) {
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

export async function resolvePoster(
	mediaId: number,
	type: MediaType,
	externalId: string,
	posterPath: string | null,
) {
	if (!posterPath) return "/posters/placeholder.jpg";

	const filename = posterFilename(mediaId, posterPath);
	const filePath = path.join(POSTER_DIR, filename);

	try {
		await access(filePath);
	} catch {
		await mkdir(POSTER_DIR, { recursive: true });
		const res = await fetch(sourceUrlFor(type, externalId, posterPath));
		if (!res.ok) throw new Error("Poster download failed");
		await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
	}

	return `/posters/cache/${filename}`;
}
