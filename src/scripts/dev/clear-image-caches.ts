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

// Only the re-derivable *_DIR caches — deleting is never lossy since the
// next request just re-fetches/re-encodes. Excludes CROPPED_DIR and
// LIST_THUMBNAIL_DIR, which hold user-generated content with no source to regenerate from.
const CACHE_DIRS = [
	POSTER_DIR,
	CHANGELOG_THUMB_DIR,
	BANNER_DIR,
	CHANGELOG_BANNER_THUMB_DIR,
	PERSON_PHOTO_DIR,
	LINK_EMBED_DIR,
];

// Dev-only: lets a resize/quality/format change in poster-resolver.ts
// actually take effect — cache files are keyed by source URL, not encode
// settings, so a stale file would otherwise be served forever.
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

	// Next's optimizer cache — currently kept empty by images.unoptimized, but harmless to clear.
	// turbopackIgnore: process.cwd()-relative, never request-derived.
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
