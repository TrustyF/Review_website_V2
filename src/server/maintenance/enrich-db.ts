import { db } from "@/server/db/client";
import { fetchTmdbById, fetchTvShowById } from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { updateTvShowFromTmdb } from "@/server/tmdb/ingest/tv-show";
import {
	fetchMangaDexById,
	fetchMangaDexStatistics,
} from "@/server/mangadex/client";
import { updateMangaFromMangaDex } from "@/server/mangadex/ingest/manga";
import { fetchIgdbGameById } from "@/server/igdb/client";
import { updateGameFromIgdb } from "@/server/igdb/ingest/game";
import { fetchComicVineById } from "@/server/comicvine/client";
import { updateComicFromComicVine } from "@/server/comicvine/ingest/comic";
import { Media, MediaType } from "@prisma/client";

async function enrichOne(media: Media) {
	// Guaranteed non-null by main()'s where filter below — narrowed here just
	// to satisfy the type, not a real runtime possibility.
	if (!media.externalId) return;
	const externalId = media.externalId;

	if (media.type === MediaType.MOVIE || media.type === MediaType.SHORT) {
		const data = await fetchTmdbById(externalId, media.type);
		await updateMovieFromTmdb(data);
	} else if (media.type === MediaType.TVSHOW) {
		const data = await fetchTvShowById(externalId);
		await updateTvShowFromTmdb(data);
	} else if (media.type === MediaType.MANGA) {
		const [data, statistics] = await Promise.all([
			fetchMangaDexById(externalId),
			fetchMangaDexStatistics(externalId),
		]);
		await updateMangaFromMangaDex(data, statistics);
	} else if (media.type === MediaType.GAME) {
		const data = await fetchIgdbGameById(externalId);
		await updateGameFromIgdb(data);
	} else if (media.type === MediaType.COMIC) {
		const data = await fetchComicVineById(externalId);
		await updateComicFromComicVine(data);
	} else {
		console.log(
			`skipping ${media.title}: no enrichment ingest for ${media.type} yet`,
		);
	}
}

// Each media type talks to its own independent (and independently
// rate-limited) API — TMDB, MangaDex, IGDB, ComicVine. Processing every
// PENDING row as one big sequential queue meant the other three sources sat
// idle whenever one of them was slow or backing off. Splitting into one
// queue per type and running those queues concurrently keeps each type's
// own pacing intact (still sequential *within* a type, so e.g. IGDB's
// 429 retry/backoff still behaves the same) while letting all four sources
// make progress at once instead of taking turns.
async function runQueue(type: MediaType, mediaList: Media[]) {
	for (const media of mediaList) {
		console.log(`[${type}] trying ${media.title}`);
		try {
			await enrichOne(media);
		} catch (err) {
			// One title missing/renamed at the source (or otherwise broken)
			// shouldn't stop the rest of its queue from enriching — log it and
			// move on, leaving that row PENDING for a later look.
			console.error(
				`[${type}] Failed enriching media ${media.id} (${media.title})`,
				err,
			);
		}
	}
}

const ENRICH_INTERVAL_DAYS = 3;

async function main() {
	const enrichCutoff = new Date(
		Date.now() - ENRICH_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
	);

	const mediaList = await db.media.findMany({
		where: {
			externalId: { not: null },
			OR: [{ lastEnrichedAt: null }, { lastEnrichedAt: { lt: enrichCutoff } }],
		},
		orderBy: { id: "asc" },
	});

	const queues = new Map<MediaType, Media[]>();
	for (const media of mediaList) {
		const queue = queues.get(media.type);
		if (queue) queue.push(media);
		else queues.set(media.type, [media]);
	}

	await Promise.all(
		[...queues.entries()].map(([type, list]) => runQueue(type, list)),
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
