// Dev-only in-memory tally of how many times a given key was hit during this
// dev server process's lifetime — lets you check e.g. "how many
// /api/image-proxy calls did editing one poster actually trigger" without
// digging through Vercel's dashboard. No-ops in production: a real
// deployment spreads invocations across many isolated instances, so this
// process-local Map wouldn't see most of them anyway, and there's no reason
// to pay for the bookkeeping there.
const counts = new Map<string, number>();
let windowStartedAt = Date.now();

export function recordInvocation(key: string): void {
	if (process.env.NODE_ENV !== "development") return;
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

export type InvocationSnapshot = {
	windowStartedAt: number;
	total: number;
	byKey: [key: string, count: number][];
};

export function getInvocationCounts(): InvocationSnapshot {
	const byKey = [...counts.entries()].sort((a, b) => b[1] - a[1]);
	return {
		windowStartedAt,
		total: byKey.reduce((sum, [, n]) => sum + n, 0),
		byKey,
	};
}

export function resetInvocationCounts(): void {
	counts.clear();
	windowStartedAt = Date.now();
}
