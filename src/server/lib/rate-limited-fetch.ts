function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RateLimiter = {
	fetch(input: string | URL, init?: RequestInit): Promise<Response>;
};

// One shared singleton per external source, so every caller funnels through the same queue and 429 handling.
export function createRateLimiter({
	minIntervalMs,
	retryFallbackMs = 1000,
}: {
	// Minimum spacing between request starts — a serialized queue, not a token bucket, since no burst allowance is needed.
	minIntervalMs: number;
	// Backoff used on a 429 with no Retry-After header.
	retryFallbackMs?: number;
}): RateLimiter {
	let lastRequestAt = 0;
	// Every call chains onto this so callers queue in arrival order instead of racing the same lastRequestAt check.
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

		// Retried exactly once; a second 429 falls through to the caller's own !res.ok handling.
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
