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

// Temporary debug instrumentation for the recurring "infinite tab spinner"
// bug — logs every outbound server-side fetch's start and outcome (ok/error/
// aborted) with duration, so a fetch that hangs past its timeout or never
// resolves at all shows up as a [fetch:start] with no matching [fetch:done].
// Remove once the cause is found — see proxy.ts for the matching per-request
// logging.
function loggedFetch(originalFetch: typeof fetch): typeof fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input.toString();
		const id = Math.random().toString(36).slice(2, 8);
		const start = Date.now();
		console.log(`[fetch:start] ${id} ${init?.method ?? "GET"} ${url}`);
		try {
			const res = await originalFetch(input, init);
			console.log(
				`[fetch:done] ${id} ${res.status} ${Date.now() - start}ms ${url}`,
			);
			return res;
		} catch (err) {
			const label =
				err instanceof Error && err.name === "TimeoutError"
					? "timeout"
					: err instanceof Error && err.name === "AbortError"
						? "aborted"
						: "error";
			console.log(
				`[fetch:${label}] ${id} ${Date.now() - start}ms ${url} ${err instanceof Error ? err.message : err}`,
			);
			throw err;
		}
	}) as typeof fetch;
}

export function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

	const originalFetch = globalThis.fetch;

	globalThis.fetch = loggedFetch(((
		input: RequestInfo | URL,
		init?: RequestInit,
	) => {
		if (init?.signal) return originalFetch(input, init);
		return originalFetch(input, {
			...init,
			signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
		});
	}) as typeof fetch);
}
