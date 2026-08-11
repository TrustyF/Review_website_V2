import { db } from "@/server/db/client";
import {
	BANNER_DIR,
	BANNER_FORMAT,
	mediaAssetFilename,
	POSTER_DIR,
} from "@/server/resolvers/poster-resolver";
import { getImageStorage } from "@/server/storage/image-storage";

// Deletes cached files under dir that no longer match any of validFilenames
// — leftovers from switching a poster/banner (stale hash) or from media rows
// that got deleted outright.
async function cleanupOrphans(dir: string, validFilenames: Set<string>, label: string) {
	const storage = getImageStorage();
	const files = await storage.list(dir);

	const deleted: string[] = [];
	for (const file of files) {
		if (validFilenames.has(file)) continue;
		await storage.remove(dir, file);
		deleted.push(file);
	}

	console.log(`Removed ${deleted.length} orphaned ${label} file(s).`);
	for (const file of deleted) console.log(`  ${file}`);
}

// Safe to re-run any time / on a schedule.
async function main() {
	const mediaList = await db.media.findMany({
		where: { OR: [{ posterPath: { not: null } }, { bannerPath: { not: null } }] },
		select: { id: true, posterPath: true, bannerPath: true },
	});

	const validPosterFilenames = new Set(
		mediaList
			.filter((m) => m.posterPath)
			.map((m) => mediaAssetFilename(m.id, m.posterPath as string)),
	);
	const validBannerFilenames = new Set(
		mediaList
			.filter((m) => m.bannerPath)
			.map((m) => mediaAssetFilename(m.id, m.bannerPath as string, BANNER_FORMAT)),
	);

	await cleanupOrphans(POSTER_DIR, validPosterFilenames, "poster");
	await cleanupOrphans(BANNER_DIR, validBannerFilenames, "banner");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
