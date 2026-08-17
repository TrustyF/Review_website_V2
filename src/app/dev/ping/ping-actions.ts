"use server";

// Diagnostic-only, no DB/storage/external calls — a baseline for "however
// much Next's own server action invocation costs on this route" (cold
// function init, RSC action plumbing, network), independent of anything a
// real action (e.g. search-actions.ts's searchAllMedia) actually does.
// Compare this action's network-tab time against a real one's: if ping is
// just as slow, the cost is generic invocation/cold-start overhead, not
// application code — no amount of optimizing the real action's own logic
// will close that gap. Temporary — remove once the search latency
// investigation this was added for is resolved.
export async function ping(): Promise<{ serverTimestamp: number }> {
	return { serverTimestamp: Date.now() };
}
