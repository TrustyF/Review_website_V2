import { db } from "@/server/db/client";
import { fetchTmdbById } from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { EnrichmentStatus, MediaType } from "@prisma/client";

// Prisma has no ORDER BY RANDOM(); decorate-sort-undecorate on a random key
// avoids that plus the indexed-access pitfalls of an in-place shuffle.
function pickRandom<T>(items: T[], count: number): T[] {
	return items
		.map((item) => ({ item, sortKey: Math.random() }))
		.sort((a, b) => a.sortKey - b.sortKey)
		.slice(0, count)
		.map(({ item }) => item);
}

async function main() {
	const pending = await db.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.PENDING },
		select: { id: true },
	});
	const pickedIds = pickRandom(pending, 25).map((m) => m.id);

	const mediaList = await db.media.findMany({
		where: { id: { in: pickedIds } },
	});

	for (const media of mediaList) {
		if (
			media.type === MediaType.MOVIE ||
			media.type === MediaType.SHORT ||
			media.type === MediaType.TVSHOW
		) {
			console.log(`starting fetch for ${media.title}`);
			const data = await fetchTmdbById(media.externalId, media.type);
			await updateMovieFromTmdb(data);
		} else {
			// TVSHOW/MANGA/COMIC/GAME don't have an ingest path yet —
			// updateMovieFromTmdb assumes a movie shape and would throw.
			console.log(
				`skipping ${media.title}: no enrichment ingest for ${media.type} yet`,
			);
		}
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
