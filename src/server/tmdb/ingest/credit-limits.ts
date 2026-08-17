// Applied by movie-credits.ts and tv-show-credits.ts before any credit rows
// get built — ingesting TMDB's cast/crew arrays uncapped left the DB with
// ~72 people per media item on average (98.7k Person rows for 1374 media),
// which made the global search index (search-actions.ts) big enough to blow
// past Vercel's 10s function timeout on a cache-miss rebuild. Capping here
// keeps that from recurring on future ingests/re-enrichments; it doesn't
// touch rows already ingested.

// TMDB's cast `order` is billing order (0 = top-billed) — the only
// notability signal cast credits actually carry. 25 comfortably covers every
// named/speaking role a media page or search result would plausibly be
// shown for; TMDB casts often run into the hundreds once background/extra
// entries are included.
export const MAX_BILLED_CAST = 25;

// Crew has no equivalent ranking field, and rosters can run into the
// hundreds for VFX-heavy productions (individual compositors, riggers,
// etc.) — so crew is capped by an allowlist of department-head-level job
// titles instead of a count. Matches what this app can actually surface (a
// person's mainRoleFor label in search, the credit list on a media page); a
// first-unit rigger was never going to be shown or searched for anyway.
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
