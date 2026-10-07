const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Weeks since the epoch — the shared seed for the home page's weekly spotlights.
export function currentWeekIndex(): number {
	return Math.floor(Date.now() / WEEK_MS);
}

// Stable pick for the week; candidates must already be in a deterministic order.
export function pickForWeek<T>(candidates: T[], week: number): T | undefined {
	if (candidates.length === 0) return undefined;
	return candidates[week % candidates.length];
}

// Partial Fisher-Yates — only the first `count` slots get shuffled.
export function sample<T>(items: T[], count: number): T[] {
	const pool = [...items];
	const n = Math.min(count, pool.length);
	for (let i = 0; i < n; i++) {
		const j = i + Math.floor(Math.random() * (pool.length - i));
		[pool[i], pool[j]] = [pool[j]!, pool[i]!];
	}
	return pool.slice(0, n);
}
