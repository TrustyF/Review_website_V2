import { rm } from "fs/promises";
import path from "path";
import {
	POSTER_DIR,
	CHANGELOG_THUMB_DIR,
	BANNER_DIR,
	CHANGELOG_BANNER_THUMB_DIR,
	PERSON_PHOTO_DIR,
	LINK_EMBED_DIR,
} from "@/server/resolvers/poster-resolver";
import { getImageStorage } from "@/server/storage/image-storage";

// Only the re-derivable *_DIR caches from poster-resolver.ts — every file in
// here is just a resize/quality/format re-encode of a source the app can
// always re-fetch (TMDB/IGDB/etc) or re-derive from, keyed by content hash
// (see mediaAssetFilename), so deleting them is never lossy: the next
// request just re-runs cacheOrDownload and writes a fresh file. Deliberately
// excludes CROPPED_DIR (image-crop-resolver.ts) and LIST_THUMBNAIL_DIR
// (list-thumbnail-resolver.ts) — those hold actual user-generated crops/
// thumbnails with no source to regenerate from, not caches.
const CACHE_DIRS = [
	POSTER_DIR,
	CHANGELOG_THUMB_DIR,
	BANNER_DIR,
	CHANGELOG_BANNER_THUMB_DIR,
	PERSON_PHOTO_DIR,
	LINK_EMBED_DIR,
];

// Dev-only: for trying out a new resize/quality/format setting in poster-
// resolver.ts and actually seeing it take effect, rather than the old
// cached file (content-addressed by source URL, not by the settings used to
// encode it — a quality/format change alone doesn't change the filename, so
// the stale file would otherwise keep being served forever).
async function main() {
	const storage = getImageStorage();

	let removed = 0;
	for (const dir of CACHE_DIRS) {
		const files = await storage.list(dir);
		for (const file of files) {
			if (await storage.remove(dir, file)) removed++;
		}
		console.log(`${dir}: removed ${files.length} file(s)`);
	}

	// Next's own optimizer cache — images.unoptimized in next.config.ts keeps
	// this empty now, but clearing it is harmless if that ever changes.
	// turbopackIgnore: process.cwd()-relative, never request-derived, same as
	// LocalImageStorage.absDir above.
	const nextImageCache = path.join(
		/* turbopackIgnore: true */ process.cwd(),
		".next/cache/images",
	);
	await rm(nextImageCache, { recursive: true, force: true });
	console.log(`.next/cache/images: cleared`);

	console.log(`\nRemoved ${removed} cached image file(s) total.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
