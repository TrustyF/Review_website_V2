import { db } from "@/server/db/client";
import {
	BANNER_DIR,
	BANNER_FORMAT,
	mediaAssetFilename,
	POSTER_DIR,
} from "@/server/resolvers/poster-resolver";
import { getImageStorage } from "@/server/storage/image-storage";
import { appendJobSummary, formatSummaryList } from "./job-summary";

// Deletes cached files under dir not in validFilenames — leftovers from switching a poster/banner or from deleted media rows.
async function cleanupOrphans(
	dir: string,
	validFilenames: Set<string>,
	label: string,
): Promise<string[]> {
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
	return deleted;
}

// Safe to re-run any time / on a schedule.
async function main() {
	const mediaList = await db.media.findMany({
		where: {
			OR: [{ posterPath: { not: null } }, { bannerPath: { not: null } }],
		},
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
			.map((m) =>
				mediaAssetFilename(m.id, m.bannerPath as string, BANNER_FORMAT),
			),
	);

	const deletedPosters = await cleanupOrphans(
		POSTER_DIR,
		validPosterFilenames,
		"poster",
	);
	const deletedBanners = await cleanupOrphans(
		BANNER_DIR,
		validBannerFilenames,
		"banner",
	);

	await appendJobSummary([
		"## Cleanup Posters",
		"",
		"| Type | Removed |",
		"| --- | --- |",
		`| Poster | ${deletedPosters.length} |`,
		`| Banner | ${deletedBanners.length} |`,
		...(deletedPosters.length + deletedBanners.length > 0
			? [
					"",
					"### Removed files",
					"",
					...formatSummaryList([
						...deletedPosters.map((f) => `[poster] ${f}`),
						...deletedBanners.map((f) => `[banner] ${f}`),
					]),
				]
			: []),
	]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
