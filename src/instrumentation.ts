// Registered once per server instance (see instrumentation.js docs). Patches
// global fetch so every server-side call that doesn't already manage its own
// abort/duration gets a hard ceiling — the exact gap that let a hung upstream
// image download (poster-resolver.ts) leave a response open forever and keep
// the browser tab spinner spinning (see git history on that file).
//
// Only fills in when the call site hasn't already supplied a `signal` — a
// fetch that needs longer than the default just passes its own
// `signal: AbortSignal.timeout(<longer ms>)` (or a real AbortController) and
// this default steps aside entirely, rather than racing/clamping it.
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
