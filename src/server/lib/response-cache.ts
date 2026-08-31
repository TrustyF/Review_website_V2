import { mkdir, readFile, writeFile } from "fs/promises";
import { AsyncLocalStorage } from "async_hooks";
import path from "path";

// Opt-in dev toggle (CACHE_RESPONSES=1 in your own gitignored .env) to replay cached JSON instead of hitting the network/rate limits on every re-run. No-op otherwise.
const CACHE_RESPONSES = process.env.CACHE_RESPONSES === "1";
const FIXTURE_ROOT = path.join(process.cwd(), ".fixtures");

export function isCachingResponses(): boolean {
	return CACHE_RESPONSES;
}

// Lets callers report whether an item hit the network or replayed from a fixture, without threading it through every return type. Scoped per call tree so concurrent items don't share state.
const cacheUsageTracker = new AsyncLocalStorage<{
	calledApi: boolean;
	readCache: boolean;
}>();

export type CacheUsage = "api call" | "cache read" | null;

// Never rejects, even on error, so the caller can still log which cache path was taken; the original error is returned, not thrown.
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
	// Any real fetch in the tree means the item wasn't a pure cache replay.
	const cacheUsageOf = () =>
		store.calledApi ? "api call" : store.readCache ? "cache read" : null;
	try {
		const result = await cacheUsageTracker.run(store, fn);
		return { result, cacheUsage: cacheUsageOf() };
	} catch (error) {
		return { error, cacheUsage: cacheUsageOf() };
	}
}

// `source` namespaces the fixture directory per API so cache keys never collide and can be cleared independently.
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
		// Missing or corrupt — fall through to a real fetch and (re-)seed the file.
	}

	const json = await fetchJson();
	const store = cacheUsageTracker.getStore();
	if (store) store.calledApi = true;
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify(json, null, 2));
	return json;
}
