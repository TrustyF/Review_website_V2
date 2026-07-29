import { db } from "@/server/db/client";
import { fetchTmdbById, fetchTvShowById } from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { updateTvShowFromTmdb } from "@/server/tmdb/ingest/tv-show";
import { EnrichmentStatus, MediaType } from "@prisma/client";

async function main() {
	const mediaList = await db.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.PENDING,
			type: MediaType.TVSHOW,
		},
		take: 10,
		orderBy: { id: "asc" },
	});

	for (const media of mediaList) {
		console.log(`trying ${media.title}`);
		try {
			if (media.type === MediaType.MOVIE || media.type === MediaType.SHORT) {
				const data = await fetchTmdbById(media.externalId, media.type);
				await updateMovieFromTmdb(data);
			} else if (media.type === MediaType.TVSHOW) {
				const data = await fetchTvShowById(media.externalId);
				await updateTvShowFromTmdb(data);
			} else {
				// MANGA/COMIC/GAME aren't TMDB media — no ingest path for them.
				console.log(
					`skipping ${media.title}: no enrichment ingest for ${media.type} yet`,
				);
			}
		} catch (err) {
			throw new Error(`Failed enriching media ${media.id} (${media.title})`, {
				cause: err,
			});
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
