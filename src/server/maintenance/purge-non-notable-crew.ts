import { db } from "@/server/db/client";
import { MediaType } from "@prisma/client";
import { NOTABLE_CREW_JOBS } from "@/server/tmdb/ingest/credit-limits";
import { rebuildPersistedSearchIndex } from "@/components/search/search-actions";

// One-off cleanup for crew data ingested before credit-limits.ts existed —
// deletes Credit rows for TMDB crew jobs outside NOTABLE_CREW_JOBS (e.g.
// individual VFX/camera crew), then removes any Person left with zero
// remaining credits. Cast is untouched here: MAX_BILLED_CAST needs each
// credit's TMDB billing `order`, which every Actor Credit row here already
// has, but there's no "was this actually within the cap at ingest time"
// marker to filter on after the fact — trimming an oversized cast requires
// an actual re-enrichment (refetching from TMDB), not just a DB purge. Safe
// to re-run; a second run just finds nothing left to delete.
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
