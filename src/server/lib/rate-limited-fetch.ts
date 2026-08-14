function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RateLimiter = {
	fetch(input: string | URL, init?: RequestInit): Promise<Response>;
};

// One of these per external source (see each client.ts's own module-level
// instance — same "cached singleton, not re-created per call" shape as
// igdb/client.ts's own cachedToken), so every request that source's client
// issues — batch enrichment, ad-hoc search, anything else — funnels through
// the same queue and the same 429 handling, regardless of how many call
// sites are invoking it concurrently.
export function createRateLimiter({
	minIntervalMs,
	retryFallbackMs = 1000,
}: {
	// Minimum spacing enforced between request *starts* — a plain serialized
	// queue rather than a token bucket, since none of these sources need
	// burst allowance, just a steady rate.
	minIntervalMs: number;
	// Backoff used on a 429 with no Retry-After header.
	retryFallbackMs?: number;
}): RateLimiter {
	let lastRequestAt = 0;
	// Every call chains onto this, so callers queue up in arrival order and
	// each only proceeds once the one before it has claimed its slot —
	// without this, N concurrent callers would all race the same
	// lastRequestAt check and could all pass through together.
	let queueTail: Promise<void> = Promise.resolve();

	async function acquireSlot() {
		const wait = Math.max(0, lastRequestAt + minIntervalMs - Date.now());
		if (wait > 0) await sleep(wait);
		lastRequestAt = Date.now();
	}

	async function fetchThrottled(
		input: string | URL,
		init?: RequestInit,
	): Promise<Response> {
		const mySlot = queueTail.then(acquireSlot);
		queueTail = mySlot;
		await mySlot;

		const res = await fetch(input, init);
		if (res.status !== 429) return res;

		// Retried exactly once — a second 429 (or anything else) just returns
		// here and lets the caller's own !res.ok handling deal with it the
		// same way it already handles any other failure, rather than looping.
		const retryAfter = Number(res.headers.get("Retry-After"));
		const delayMs =
			Number.isFinite(retryAfter) && retryAfter > 0
				? retryAfter * 1000
				: retryFallbackMs;
		await sleep(delayMs);
		return fetch(input, init);
	}

	return { fetch: fetchThrottled };
}
