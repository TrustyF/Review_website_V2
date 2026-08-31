// Dev-only in-memory tally of hits per key, for spotting e.g. redundant image-proxy calls. No-ops in production since a process-local Map can't see across instances.
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
