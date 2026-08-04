import "dotenv/config";
import { db } from "@/server/db/client";
import { MediaType } from "@prisma/client";
import { fetchIgdbGameById } from "@/server/igdb/client";
import { fetchComicVineById } from "@/server/comicvine/client";

// One-time backfill: sourceUrl only started being set going forward once
// ingest was updated to write it — every media row created before that has
// it null. TMDB/MangaDex URLs are fully derivable from (type, externalId)
// alone, no API call needed. IGDB/ComicVine URLs are slug-based and only
// the provider knows the real slug, so those need one live call per row —
// reuses the same fetch functions ingest already uses, with IGDB's
// existing 429 retry/backoff along for the ride.
function localSourceUrl(type: MediaType, externalId: string): string | null {
	switch (type) {
		case MediaType.MOVIE:
		case MediaType.SHORT:
			return `https://www.themoviedb.org/movie/${externalId}`;
		case MediaType.TVSHOW:
			return `https://www.themoviedb.org/tv/${externalId}`;
		case MediaType.MANGA:
			return `https://mangadex.org/title/${externalId}`;
		default:
			return null;
	}
}

async function backfillLocal() {
	const rows = await db.media.findMany({
		where: {
			type: {
				in: [
					MediaType.MOVIE,
					MediaType.SHORT,
					MediaType.TVSHOW,
					MediaType.MANGA,
				],
			},
			sourceUrl: null,
			externalId: { not: "" },
		},
		select: { id: true, type: true, externalId: true },
	});

	for (const row of rows) {
		const sourceUrl = localSourceUrl(row.type, row.externalId);
		if (!sourceUrl) continue;
		await db.media.update({ where: { id: row.id }, data: { sourceUrl } });
	}

	console.log(
		`Backfilled sourceUrl locally for ${rows.length} MOVIE/SHORT/TVSHOW/MANGA rows`,
	);
}

async function backfillGames() {
	const rows = await db.media.findMany({
		where: { type: MediaType.GAME, sourceUrl: null, externalId: { not: "" } },
		select: { id: true, title: true, externalId: true },
	});

	let updated = 0;
	for (const row of rows) {
		try {
			const game = await fetchIgdbGameById(row.externalId);
			await db.media.update({
				where: { id: row.id },
				data: { sourceUrl: game.url },
			});
			updated++;
		} catch (err) {
			console.error(
				`Failed to backfill sourceUrl for game "${row.title}" (${row.id})`,
				err,
			);
		}
	}

	console.log(`Backfilled sourceUrl for ${updated}/${rows.length} GAME rows`);
}

async function backfillComics() {
	const rows = await db.media.findMany({
		where: { type: MediaType.COMIC, sourceUrl: null, externalId: { not: "" } },
		select: { id: true, title: true, externalId: true },
	});

	let updated = 0;
	for (const row of rows) {
		try {
			const volume = await fetchComicVineById(row.externalId);
			const sourceUrl =
				volume.site_detail_url ??
				`https://comicvine.gamespot.com/volume/4050-${volume.id}/`;
			await db.media.update({ where: { id: row.id }, data: { sourceUrl } });
			updated++;
		} catch (err) {
			console.error(
				`Failed to backfill sourceUrl for comic "${row.title}" (${row.id})`,
				err,
			);
		}
	}

	console.log(`Backfilled sourceUrl for ${updated}/${rows.length} COMIC rows`);
}

async function main() {
	await backfillLocal();
	// GAME and COMIC each hit their own independent provider — run
	// concurrently rather than making one wait on the other, same reasoning
	// as enrich-db.ts's per-type queues.
	await Promise.all([backfillGames(), backfillComics()]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
