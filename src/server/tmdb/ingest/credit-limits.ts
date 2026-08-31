// Caps applied before credit rows get built — uncapped ingest left ~72 people per media item on
// average, bloating the search index past Vercel's 10s function timeout on a cache-miss rebuild.
// Doesn't touch rows already ingested.

// TMDB's cast `order` is billing order (0 = top-billed), the only notability signal available.
export const MAX_BILLED_CAST = 250;

// Crew has no ranking field, so it's capped by an allowlist of department-head-level job titles instead.
export const NOTABLE_CREW_JOBS = new Set([
	"Director",
	"Writer",
	"Screenplay",
	"Story",
	"Creator",
	"Producer",
	"Executive Producer",
	"Original Music Composer",
	"Director of Photography",
	"Editor",
	"Production Design",
	"Costume Design",
	"Casting",
]);

export function capCast<T extends { order: number }>(cast: T[]): T[] {
	return cast.filter((c) => c.order < MAX_BILLED_CAST);
}

export function filterNotableCrew<T extends { job: string }>(crew: T[]): T[] {
	return crew.filter((c) => NOTABLE_CREW_JOBS.has(c.job));
}
