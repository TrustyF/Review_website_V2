// Patches global fetch with hard ceiling; steps aside if caller
// supplied signal (no racing/clamping).
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	const originalFetch = globalThis.fetch;

	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		if (init?.signal) return originalFetch(input, init);
		return originalFetch(input, {
			...init,
			signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
		});
	}) as typeof fetch;
}
