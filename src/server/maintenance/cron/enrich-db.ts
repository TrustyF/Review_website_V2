import { db } from "@/server/db/client";
import {
	fetchTmdbById,
	fetchTvShowById,
	isTmdbReachable,
} from "@/server/tmdb/client";
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
import { appendJobSummary, formatSummaryList } from "./job-summary";

// One reachability check per underlying source (not per MediaType) so a down source is skipped as a whole queue instead of burning through doomed per-item requests.
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
	// Guaranteed non-null by main()'s where filter; narrowed here just for the type.
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

// Each item's enrichOne() is an independent transaction spending most of its time on network I/O, so items can safely run concurrently up to a per-type limit.
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

// A simple counting semaphore — acquire() resolves immediately while under the limit, otherwise waits for a release().
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

// Caps how many enrichOne() calls (each its own transaction) can be in flight across all type queues at once, since summed concurrency would otherwise exceed the DB pool size and hit P2028 timeouts.
// Set high rather than conservative: against a remote DB the wait is mostly network latency (more in-flight items hide it for free), and occasional lock contention from concurrent resolve*Batch
// upsert races just fails and retries next run (row stays PENDING) rather than corrupting anything — an acceptable tradeoff for real throughput.
const GLOBAL_DB_CONCURRENCY = 40;
const dbSemaphore = createSemaphore(GLOBAL_DB_CONCURRENCY);

// Bounds in-flight items per type only; real rate limiting lives in each source's client (rate-limited-fetch.ts), and dbSemaphore above bounds transactions system-wide.
// Doesn't need to stay under each source's real request rate — a higher number just means more items waiting on that source's own limiter. Set equal to
// GLOBAL_DB_CONCURRENCY so a single-type run can use the whole DB budget instead of being capped below it.
const QUEUE_CONCURRENCY: Record<MediaType, number> = {
	[MediaType.MOVIE]: GLOBAL_DB_CONCURRENCY,
	[MediaType.SHORT]: GLOBAL_DB_CONCURRENCY,
	[MediaType.TVSHOW]: GLOBAL_DB_CONCURRENCY,
	[MediaType.MANGA]: GLOBAL_DB_CONCURRENCY,
	[MediaType.GAME]: GLOBAL_DB_CONCURRENCY,
	[MediaType.COMIC]: GLOBAL_DB_CONCURRENCY,
	[MediaType.BOOK]: GLOBAL_DB_CONCURRENCY,
};

// One queue per media type, run concurrently, so a slow/backing-off source doesn't idle the others; within a queue, items also run up to QUEUE_CONCURRENCY[type] at a time.
type QueueResult = {
	succeeded: number;
	failures: { id: number; title: string }[];
};

async function runQueue(
	type: MediaType,
	mediaList: Media[],
): Promise<QueueResult> {
	const result: QueueResult = { succeeded: 0, failures: [] };
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
					// One broken title shouldn't stop the rest of its queue — log and move on, leaving the row PENDING.
					console.error(
						`[${type}]${cacheTag} Failed enriching media ${media.id} (${media.title})`,
						error,
					);
					result.failures.push({ id: media.id, title: media.title });
				} else {
					console.log(`[${type}]${cacheTag} enriched ${media.title}`);
					result.succeeded++;
				}
			} finally {
				dbSemaphore.release();
			}
		},
	);
	return result;
}

async function writeJobSummary(
	results: Map<MediaType, QueueResult>,
	skipped: MediaType[],
) {
	const lines = [
		"## Enrich DB",
		"",
		"| Type | Succeeded | Failed |",
		"| --- | --- | --- |",
	];
	for (const [type, { succeeded, failures }] of results) {
		lines.push(`| ${type} | ${succeeded} | ${failures.length} |`);
	}
	for (const type of skipped) {
		lines.push(`| ${type} | skipped (source unreachable) | — |`);
	}

	const allFailures = [...results.entries()].flatMap(([type, { failures }]) =>
		failures.map((f) => `[${type}] ${f.title} (id ${f.id})`),
	);
	if (allFailures.length > 0) {
		lines.push("", "### Failures", "", ...formatSummaryList(allFailures));
	}

	await appendJobSummary(lines);
}

const ENRICH_INTERVAL_DAYS = 3;

const ALL_MEDIA_TYPES = Object.values(MediaType);

// Opt-in dev flag (`... -- movie ignore-enrich-cutoff`) to re-enrich every matching row regardless of lastEnrichedAt, for testing ingest changes.
const IGNORE_CUTOFF_FLAG = "ignore-enrich-cutoff";

// Space/comma-separated MediaType names, case-insensitive; no args enriches every type. IGNORE_CUTOFF_FLAG is filtered out before validation.
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
		// take: 1000,
	});

	const queues = new Map<MediaType, Media[]>();
	for (const media of mediaList) {
		const queue = queues.get(media.type);
		if (queue) queue.push(media);
		else queues.set(media.type, [media]);
	}

	const reachable = await reachableMediaTypes([...queues.keys()]);

	const runnable = [...queues.entries()].filter(([type]) =>
		reachable.has(type),
	);
	const skipped = [...queues.keys()].filter((type) => !reachable.has(type));

	const results = new Map<MediaType, QueueResult>(
		await Promise.all(
			runnable.map(
				async ([type, list]) => [type, await runQueue(type, list)] as const,
			),
		),
	);

	await writeJobSummary(results, skipped);

	// Runs as a separate process from the admin actions that normally trigger this, so search-actions.ts's caches wouldn't otherwise pick up the change until their own TTL.
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
