import { db } from "@/server/db/client";
import {
	fetchTmdbById,
	fetchTvShowById,
	isTmdbReachable,
} from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { updateTvShowFromTmdb } from "@/server/tmdb/ingest/tv-show";
import {
	fetchMangaDexById,
	fetchMangaDexStatistics,
	isMangaDexReachable,
} from "@/server/mangadex/client";
import { updateMangaFromMangaDex } from "@/server/mangadex/ingest/manga";
import { fetchIgdbGameById, isIgdbReachable } from "@/server/igdb/client";
import { updateGameFromIgdb } from "@/server/igdb/ingest/game";
import {
	fetchComicVineById,
	isComicVineReachable,
} from "@/server/comicvine/client";
import { updateComicFromComicVine } from "@/server/comicvine/ingest/comic";
import {
	fetchGoogleBooksById,
	isGoogleBooksReachable,
} from "@/server/google-books/client";
import { updateBookFromGoogleBooks } from "@/server/google-books/ingest/book";
import { Media, MediaType } from "@prisma/client";

// One reachability check per underlying source (TMDB backs both MOVIE/SHORT
// and TVSHOW, so they share a check) rather than per MediaType — run once up
// front so a source that's down gets skipped as a whole queue instead of
// burning through hundreds of doomed per-item requests against it.
const SOURCE_HEALTH_CHECKS: Record<string, () => Promise<boolean>> = {
	tmdb: isTmdbReachable,
	mangadex: isMangaDexReachable,
	igdb: isIgdbReachable,
	comicvine: isComicVineReachable,
	"google-books": isGoogleBooksReachable,
};

const MEDIA_TYPE_SOURCE: Partial<Record<MediaType, string>> = {
	[MediaType.MOVIE]: "tmdb",
	[MediaType.SHORT]: "tmdb",
	[MediaType.TVSHOW]: "tmdb",
	[MediaType.MANGA]: "mangadex",
	[MediaType.GAME]: "igdb",
	[MediaType.COMIC]: "comicvine",
	[MediaType.BOOK]: "google-books",
};

// Checks only the sources actually needed for this run's queues, in
// parallel, and returns which of those types are safe to process.
async function reachableMediaTypes(
	types: MediaType[],
): Promise<Set<MediaType>> {
	const sources = new Set(
		types.map((type) => MEDIA_TYPE_SOURCE[type]).filter((s) => s !== undefined),
	);

	const results = await Promise.all(
		[...sources].map(async (source) => {
			const check = SOURCE_HEALTH_CHECKS[source];
			const reachable = check ? await check() : true;
			if (!reachable)
				console.error(`[health check] ${source} is unreachable, skipping`);
			return [source, reachable] as const;
		}),
	);
	const reachableSources = new Set(
		results.filter(([, reachable]) => reachable).map(([source]) => source),
	);

	return new Set(
		types.filter((type) => {
			const source = MEDIA_TYPE_SOURCE[type];
			return source === undefined || reachableSources.has(source);
		}),
	);
}

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
	} else if (media.type === MediaType.BOOK) {
		const data = await fetchGoogleBooksById(externalId);
		await updateBookFromGoogleBooks(data);
	} else {
		console.log(
			`skipping ${media.title}: no enrichment ingest for ${media.type} yet`,
		);
	}
}

// Each media item's enrichOne() call is its own independent Prisma
// transaction with no shared mutable state across items, and most of its
// wall-clock time is spent waiting on network I/O (external API fetch + DB
// round trips) rather than CPU — so items within a queue can safely run
// concurrently up to a per-type limit, not just one at a time.
async function runWithConcurrency<T>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<void>,
) {
	let next = 0;
	async function runNext(): Promise<void> {
		const i = next++;
		const item = items[i];
		if (item === undefined) return;
		await worker(item);
		return runNext();
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, runNext),
	);
}

// Real rate limiting now lives at the client layer (each source's own
// client.ts has a rate-limited-fetch.ts throttle + single-retry-on-429 —
// see e.g. igdb/client.ts's limiter), so this is purely a concurrency cap on
// in-flight DB transactions/worker parallelism now, not the thing keeping
// any source's request rate in check — workers just queue behind that
// client-side throttle instead of firing real concurrent requests beyond it.
const QUEUE_CONCURRENCY: Record<MediaType, number> = {
	[MediaType.MOVIE]: 6,
	[MediaType.SHORT]: 6,
	[MediaType.TVSHOW]: 6,
	[MediaType.MANGA]: 6,
	[MediaType.GAME]: 3,
	[MediaType.COMIC]: 6,
	[MediaType.BOOK]: 6,
};

// Each media type talks to its own independent (and independently
// rate-limited) API — TMDB, MangaDex, IGDB, ComicVine. Processing every
// PENDING row as one big sequential queue meant the other three sources sat
// idle whenever one of them was slow or backing off. Splitting into one
// queue per type and running those queues concurrently keeps each type's
// own pacing intact while letting all sources make progress at once instead
// of taking turns — and within a single type's queue, items now also run up
// to QUEUE_CONCURRENCY[type] at a time instead of strictly one by one.
async function runQueue(type: MediaType, mediaList: Media[]) {
	await runWithConcurrency(
		mediaList,
		QUEUE_CONCURRENCY[type],
		async (media) => {
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
		},
	);
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
		take: 1000,
	});

	const queues = new Map<MediaType, Media[]>();
	for (const media of mediaList) {
		const queue = queues.get(media.type);
		if (queue) queue.push(media);
		else queues.set(media.type, [media]);
	}

	const reachable = await reachableMediaTypes([...queues.keys()]);

	await Promise.all(
		[...queues.entries()]
			.filter(([type]) => reachable.has(type))
			.map(([type, list]) => runQueue(type, list)),
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
