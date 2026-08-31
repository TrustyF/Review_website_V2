import "dotenv/config";
import { db } from "@/server/db/client";
import { MediaType } from "@prisma/client";
import { fetchTmdbById, fetchTvShowById } from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { updateTvShowFromTmdb } from "@/server/tmdb/ingest/tv-show";
import { fetchIgdbGameById } from "@/server/igdb/client";
import { updateGameFromIgdb } from "@/server/igdb/ingest/game";

// One-time catch-up: bannerPath was null for rows enriched before backdrop
// support was added. MANGA/COMIC skipped since those sources never have a
// banner. Reuses regular update*From* ingest, which only fills empty
// fields, so nothing gets clobbered.
type BannerType =
	| typeof MediaType.MOVIE
	| typeof MediaType.SHORT
	| typeof MediaType.TVSHOW
	| typeof MediaType.GAME;

async function backfillType(type: BannerType) {
	const rows = await db.media.findMany({
		where: { type, bannerPath: null, externalId: { not: null } },
		select: { id: true, title: true, externalId: true },
	});

	let updated = 0;
	for (const row of rows) {
		if (!row.externalId) continue;
		try {
			if (type === MediaType.MOVIE || type === MediaType.SHORT) {
				const data = await fetchTmdbById(row.externalId, type);
				await updateMovieFromTmdb(data);
			} else if (type === MediaType.TVSHOW) {
				const data = await fetchTvShowById(row.externalId);
				await updateTvShowFromTmdb(data);
			} else {
				const data = await fetchIgdbGameById(row.externalId);
				await updateGameFromIgdb(data);
			}
			updated++;
			console.log(`[${type}] backfilled "${row.title}" (${row.id})`);
		} catch (err) {
			console.error(
				`[${type}] failed backfilling "${row.title}" (${row.id})`,
				err,
			);
		}
	}

	console.log(`[${type}] backfilled ${updated}/${rows.length}`);
}

async function main() {
	// Each type talks to its own independently rate-limited API — run concurrently.
	await Promise.all([
		backfillType(MediaType.MOVIE),
		backfillType(MediaType.SHORT),
		backfillType(MediaType.TVSHOW),
		backfillType(MediaType.GAME),
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
