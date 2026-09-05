import "dotenv/config";
import { db } from "@/server/db/client";
import { Source } from "@prisma/client";
import { fetchTmdbPersonById } from "@/server/tmdb/client";
import { invalidateSearchIndex } from "@/components/search/search-actions";

// One-time catch-up: crew enriched before photoPath storage became unconditional
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

	// Runs outside normal request that would invalidate search index, so do it explicitly or stale photoPath lingers until cache TTL expires.
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
