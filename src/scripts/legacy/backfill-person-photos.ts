import "dotenv/config";
import { db } from "@/server/db/client";
import { Source } from "@prisma/client";
import { fetchTmdbPersonById } from "@/server/tmdb/client";
import { invalidateSearchIndex } from "@/components/search/search-actions";

// One-time catch-up: Person.photoPath used to only ever be set for cast
// (and, briefly, a curated allowlist of crew jobs) — see
// person-photo-eligibility.ts's own comment on why storage is unconditional
// now. Every crew member enriched before that field became unconditional
// (movie-credits.ts/tv-show-credits.ts) still has photoPath stuck at null,
// and won't pick one up until their next re-enrichment (enrich-db.ts's
// 3-day cycle). Queries TMDB's own lightweight /person/{id} endpoint
// directly, one call per still-missing person, rather than re-running a
// full movie/show enrichment for each — far cheaper for what's ultimately a
// single missing field. MangaDex/ComicVine/IGDB/Google Books people are
// skipped (source: Source.TMDB below) — none of those sources have ever
// supplied a photo (see Person.photoPath's own comment), so there's nothing
// to backfill for them.
async function main() {
	const people = await db.person.findMany({
		where: { source: Source.TMDB, photoPath: null },
		select: { id: true, externalId: true, name: true },
	});

	let updated = 0;
	for (const person of people) {
		try {
			const data = await fetchTmdbPersonById(person.externalId);
			if (data.profile_path) {
				await db.person.update({
					where: { id: person.id },
					data: { photoPath: data.profile_path },
				});
				updated++;
			}
			console.log(`[person] backfilled "${person.name}" (${person.id})`);
		} catch (err) {
			console.error(
				`[person] failed backfilling "${person.name}" (${person.id})`,
				err,
			);
		}
	}

	console.log(`[person] backfilled ${updated}/${people.length}`);

	// This script runs as a separate process, outside any request that would
	// normally trigger this (see saveMediaDetails/setMediaDeleted/etc. in the
	// admin actions) — without it, search-actions.ts's own module-scope and
	// durable caches would keep serving whatever photoPath (usually null) was
	// true when they were last built, for up to their own 1-hour TTL, even
	// though the DB is already updated.
	if (updated > 0) await invalidateSearchIndex();
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
