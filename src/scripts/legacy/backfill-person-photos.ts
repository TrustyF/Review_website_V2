import "dotenv/config";
import { db } from "@/server/db/client";
import { Source } from "@prisma/client";
import { fetchTmdbPersonById } from "@/server/tmdb/client";
import { invalidateSearchIndex } from "@/components/search/search-actions";

// One-time catch-up: crew enriched before photoPath storage became
// unconditional are stuck at null until their next re-enrichment cycle.
// Queries TMDB's lightweight /person/{id} directly instead of re-running a
// full enrichment. Non-TMDB sources never supply a photo, so skipped.
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

	// This runs outside any request that would normally invalidate the
	// search index, so do it explicitly or stale photoPath data lingers for
	// up to the cache's 1-hour TTL.
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
