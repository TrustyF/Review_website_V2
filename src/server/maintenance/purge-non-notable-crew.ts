import { db } from "@/server/db/client";
import { MediaType } from "@prisma/client";
import { NOTABLE_CREW_JOBS } from "@/server/tmdb/ingest/credit-limits";
import { rebuildPersistedSearchIndex } from "@/components/search/search-actions";

// One-off cleanup for crew ingested before credit-limits.ts existed: deletes Credit rows outside NOTABLE_CREW_JOBS, then orphaned People.
// Cast is untouched — trimming an oversized cast to MAX_BILLED_CAST needs re-enrichment from TMDB, not a DB purge. Safe to re-run.
async function main() {
	const { count: deletedCredits } = await db.credit.deleteMany({
		where: {
			personId: { not: null },
			role: {
				origin: { in: [MediaType.MOVIE, MediaType.SHORT, MediaType.TVSHOW] },
				name: { not: "Actor" },
				NOT: { name: { in: [...NOTABLE_CREW_JOBS] } },
			},
		},
	});

	const { count: deletedPeople } = await db.person.deleteMany({
		where: { credits: { none: {} } },
	});

	console.log(
		`Deleted ${deletedCredits} non-notable crew credit${deletedCredits === 1 ? "" : "s"}, ` +
			`${deletedPeople} orphaned person${deletedPeople === 1 ? "" : "s"}.`,
	);

	if (deletedCredits > 0 || deletedPeople > 0) {
		const itemCount = await rebuildPersistedSearchIndex();
		console.log(`Rebuilt search index (${itemCount} entries).`);
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
