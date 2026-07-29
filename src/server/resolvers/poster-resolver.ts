import { access, mkdir, writeFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

export const POSTER_DIR = path.join(process.cwd(), "public", "posters", "cache");

// Content-addressable: the filename is derived from posterPath itself, so
// switching a media's poster naturally produces a different filename/URL —
// no cache-busting query string or manual invalidation needed. Old files
// from a previous posterPath become orphaned; see poster-cleanup.ts.
export function posterFilename(mediaId: number, posterPath: string) {
	const hash = createHash("sha256").update(posterPath).digest("hex").slice(0, 12);
	return `${mediaId}-${hash}.jpg`;
}

export async function resolvePoster(
	mediaId: number,
	posterPath: string | null,
) {
	if (!posterPath) return "/posters/placeholder.jpg";

	const filename = posterFilename(mediaId, posterPath);
	const filePath = path.join(POSTER_DIR, filename);

	try {
		await access(filePath);
	} catch {
		await mkdir(POSTER_DIR, { recursive: true });
		const res = await fetch(`https://image.tmdb.org/t/p/w500${posterPath}`);
		if (!res.ok) throw new Error("Poster download failed");
		await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
	}

	return `/posters/cache/${filename}`;
}
