import { readdir, rm } from "fs/promises";
import path from "path";
import { db } from "@/server/db/client";
import { POSTER_DIR, posterFilename } from "@/server/resolvers/poster-resolver";

// Deletes cached poster files that no longer match any media's current
// posterPath — leftovers from switching a poster (stale hash) or from media
// rows that got deleted outright. Safe to re-run any time / on a schedule.
async function main() {
	const mediaList = await db.media.findMany({
		where: { posterPath: { not: null } },
		select: { id: true, posterPath: true },
	});

	const validFilenames = new Set(
		mediaList.map(({ id, posterPath }) => posterFilename(id, posterPath as string)),
	);

	let files: string[];
	try {
		files = await readdir(POSTER_DIR);
	} catch {
		files = [];
	}

	const deleted: string[] = [];
	for (const file of files) {
		if (validFilenames.has(file)) continue;
		await rm(path.join(POSTER_DIR, file), { force: true });
		deleted.push(file);
	}

	console.log(`Removed ${deleted.length} orphaned poster file(s).`);
	for (const file of deleted) console.log(`  ${file}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
