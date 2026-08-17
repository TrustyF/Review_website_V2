import { db } from "@/server/db/client";
import { fetchTmdbById, fetchTvShowById, isTmdbReachable } from "@/server/tmdb/client";
import { runWithCacheUsageTracking } from "@/server/lib/response-cache";
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
import { invalidateSearchIndex } from "@/components/search/search-actions";
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

// Real rate limiting lives at the client layer (each source's own client.ts
// has a rate-limited-fetch.ts throttle + single-retry-on-429 — see e.g.
// igdb/client.ts's limiter), so this only bounds how many of a given type's
// items can be in flight (fetching + writing) at once, letting each queue's
// own worker pool size reflect that source's own pacing/rate-limit
// character — it does NOT bound how many Prisma transactions are open
// system-wide, since queues for every type run concurrently. That's what
// dbSemaphore below is for.
const QUEUE_CONCURRENCY: Record<MediaType, number> = {
	[MediaType.MOVIE]: 6,
	[MediaType.SHORT]: 6,
	[MediaType.TVSHOW]: 6,
	[MediaType.MANGA]: 6,
	[MediaType.GAME]: 3,
	[MediaType.COMIC]: 6,
	[MediaType.BOOK]: 6,
};

// A simple counting semaphore — acquire() resolves immediately while under
// the limit, otherwise waits for a release().
function createSemaphore(limit: number) {
	let active = 0;
	const waiters: (() => void)[] = [];

	async function acquire(): Promise<void> {
		if (active >= limit) {
			await new Promise<void>((resolve) => waiters.push(resolve));
		}
		active++;
	}

	function release() {
		active--;
		waiters.shift()?.();
	}

	return { acquire, release };
}

// Every type's queue runs concurrently (see runQueue below) and each item's
// enrichOne() opens its own interactive Prisma transaction (see e.g.
// tv-show.ts's db.$transaction) — summed across all of QUEUE_CONCURRENCY
// above, that's up to ~39 transactions wanting a connection at once, far
// more than the connection pool (db/client.ts's PrismaPg adapter, a plain
// pg.Pool defaulting to 10) actually has. Without a cap here, most of those
// requests just queue for a pool slot until Prisma's own maxWait elapses and
// they fail with P2028 ("Unable to start a transaction in the given time")
// instead of ever running. This gates entry to enrichOne itself (fetch +
// write together, not just the transaction) so the number of connections
// requested at once never exceeds what the pool can actually hand out,
// regardless of how many types happen to be active in a given run.
const GLOBAL_DB_CONCURRENCY = 8;
const dbSemaphore = createSemaphore(GLOBAL_DB_CONCURRENCY);

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
			await dbSemaphore.acquire();
			try {
				const { error, cacheUsage } = await runWithCacheUsageTracking(() =>
					enrichOne(media),
				);
				const cacheTag = cacheUsage ? ` [${cacheUsage}]` : "";
				if (error) {
					// One title missing/renamed at the source (or otherwise broken)
					// shouldn't stop the rest of its queue from enriching — log it and
					// move on, leaving that row PENDING for a later look.
					console.error(
						`[${type}]${cacheTag} Failed enriching media ${media.id} (${media.title})`,
						error,
					);
				} else {
					console.log(`[${type}]${cacheTag} enriched ${media.title}`);
				}
			} finally {
				dbSemaphore.release();
			}
		},
	);
}

const ENRICH_INTERVAL_DAYS = 3;

const ALL_MEDIA_TYPES = Object.values(MediaType);

// Opt-in dev flag, e.g. `npm run enrich_db -- movie ignore-enrich-cutoff` —
// re-enriches every matching row regardless of lastEnrichedAt instead of
// only the ones stale enough per ENRICH_INTERVAL_DAYS. Handy for testing
// ingest changes against titles that were already enriched recently.
const IGNORE_CUTOFF_FLAG = "ignore-enrich-cutoff";

// Space- and/or comma-separated MediaType names (case-insensitive), e.g.
// `npm run enrich_db -- movie tvshow` or `npm run enrich_db -- movie,tvshow`
// — no args at all (the normal cron invocation, see enrich-db.yml) still
// enriches every type, same as before this existed. IGNORE_CUTOFF_FLAG is
// stripped out here, not a MediaType, so it's filtered before validation.
function parseRequestedTypes(argv: string[]): MediaType[] {
	const raw = argv
		.flatMap((arg) => arg.split(","))
		.map((s) => s.trim().toUpperCase())
		.filter((s) => s && s !== IGNORE_CUTOFF_FLAG.toUpperCase());
	if (raw.length === 0) return ALL_MEDIA_TYPES;

	const validNames = new Set<string>(ALL_MEDIA_TYPES);
	const invalid = raw.filter((t) => !validNames.has(t));
	if (invalid.length > 0) {
		console.error(
			`Unknown media type(s): ${invalid.join(", ")}. Valid: ${ALL_MEDIA_TYPES.join(", ")}`,
		);
		process.exit(1);
	}

	return [...new Set(raw)] as MediaType[];
}

async function main() {
	const args = process.argv.slice(2);
	const requestedTypes = parseRequestedTypes(args);
	const ignoreCutoff = args
		.flatMap((arg) => arg.split(","))
		.some((s) => s.trim().toLowerCase() === IGNORE_CUTOFF_FLAG);
	console.log(
		`Enriching: ${requestedTypes.join(", ")}${ignoreCutoff ? " (ignoring enrich cutoff)" : ""}`,
	);

	const enrichCutoff = new Date(
		Date.now() - ENRICH_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
	);

	const mediaList = await db.media.findMany({
		where: {
			type: { in: requestedTypes },
			externalId: { not: null },
			...(ignoreCutoff
				? {}
				: {
						OR: [
							{ lastEnrichedAt: null },
							{ lastEnrichedAt: { lt: enrichCutoff } },
						],
					}),
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

	// Runs as a separate process from anything that would normally trigger
	// this (see saveMediaDetails/setMediaDeleted/etc. in the admin actions) —
	// without it, search-actions.ts's own module-scope and durable caches
	// would keep serving whatever title/poster/photoPath was true before this
	// run, for up to their own 1-hour TTL, even though the DB just changed.
	if (mediaList.length > 0) await invalidateSearchIndex();
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
