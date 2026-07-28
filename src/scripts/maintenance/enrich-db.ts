import { db } from "@/server/db/client";
import { fetchTmdbById } from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { EnrichmentStatus, MediaType } from "@prisma/client";

async function main() {
	const mediaList = await db.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.PENDING },
		take: 25,
		orderBy: { id: "asc" },
	});

	for (const media of mediaList) {
		if (media.type == MediaType.MOVIE) {
			const data = await fetchTmdbById(media.externalId, media.type);
			await updateMovieFromTmdb(data);
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
