import { after } from "next/server";

// Temporary debug instrumentation for the recurring "infinite tab spinner"
// bug — called once from the root layout's render to log every top-level
// request's start and, via after(), how long it took to fully finish. A
// [layout:start] with no matching [layout:done] pinpoints the request that
// never closes its response. Kept in its own function (rather than inlined
// in the layout) so the react-compiler doesn't flag the Date.now()/
// Math.random() calls as impure render code. Remove once the cause is
// found — see instrumentation.ts for the matching outbound-fetch logging.
export function logLayoutRequestTiming() {
	const id = Math.random().toString(36).slice(2, 8);
	const start = Date.now();
	console.log(`[layout:start] ${id}`);
	after(() => {
		console.log(`[layout:done] ${id} ${Date.now() - start}ms`);
	});
}
