import { mkdir, readFile, writeFile } from "fs/promises";
import { AsyncLocalStorage } from "async_hooks";
import path from "path";

// Opt-in dev toggle for iterating on parsing/ingest logic against a real
// response without a network call — or hitting a source's rate limit — on
// every re-run. Set CACHE_RESPONSES=1 (in your own gitignored .env, never
// .env.example) and each source's cachedJson() calls persist their raw JSON
// under FIXTURE_ROOT/<source>/, keyed per call site; every call after that
// replays the file instead of hitting the network at all. Unset/falsy (the
// normal case, including prod) this is a no-op and every call goes straight
// to the network like before this existed. No path to configure — the
// directory is fixed and already gitignored (see .gitignore).
const CACHE_RESPONSES = process.env.CACHE_RESPONSES === "1";
const FIXTURE_ROOT = path.join(process.cwd(), ".fixtures");

export function isCachingResponses(): boolean {
	return CACHE_RESPONSES;
}

// Lets a caller further up the stack (e.g. enrich-db.ts's per-item log)
// report whether the item it just processed actually hit the network or was
// replayed from a fixture, without threading that fact through every
// intermediate function's return type. Scoped per async call tree via
// runWithCacheUsageTracking so concurrent queue items (across sources, since
// this tracker is shared) don't share state.
const cacheUsageTracker = new AsyncLocalStorage<{
	calledApi: boolean;
	readCache: boolean;
}>();

export type CacheUsage = "api call" | "cache read" | null;

// On error, still resolves (never rejects) so the caller can log which path
// was taken even when enrichment itself failed partway through — the
// original error is passed through in the return value instead of thrown.
export async function runWithCacheUsageTracking<T>(
	fn: () => Promise<T>,
): Promise<
	{ result: T; error?: undefined; cacheUsage: CacheUsage } | {
		result?: undefined;
		error: unknown;
		cacheUsage: CacheUsage;
	}
> {
	const store = { calledApi: false, readCache: false };
	// A real fetch happening anywhere in the tree (e.g. cache had the main
	// record but not a secondary one, like TMDB images) means the item wasn't
	// a pure cache replay.
	const cacheUsageOf = () =>
		store.calledApi ? "api call" : store.readCache ? "cache read" : null;
	try {
		const result = await cacheUsageTracker.run(store, fn);
		return { result, cacheUsage: cacheUsageOf() };
	} catch (error) {
		return { error, cacheUsage: cacheUsageOf() };
	}
}

// `source` namespaces the fixture directory per API (tmdb, mangadex, igdb,
// comicvine, google-books, ...) so cache keys never collide across sources
// and each source's fixtures can be cleared independently.
export async function cachedJson(
	source: string,
	cacheKey: string,
	fetchJson: () => Promise<unknown>,
): Promise<unknown> {
	if (!CACHE_RESPONSES) return fetchJson();

	const file = path.join(FIXTURE_ROOT, source, `${cacheKey}.json`);
	try {
		const cached = JSON.parse(await readFile(file, "utf-8"));
		const store = cacheUsageTracker.getStore();
		if (store) store.readCache = true;
		return cached;
	} catch {
		// Missing on the first run, or corrupt/hand-edited — either way, fall
		// through to a real fetch and (re-)seed the file from it.
	}

	const json = await fetchJson();
	const store = cacheUsageTracker.getStore();
	if (store) store.calledApi = true;
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify(json, null, 2));
	return json;
}
