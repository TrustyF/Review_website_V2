import { db } from "@/server/db/client";
import { fetchTmdbById, fetchTvShowById } from "@/server/tmdb/client";
import { updateMovieFromTmdb } from "@/server/tmdb/ingest/movie";
import { updateTvShowFromTmdb } from "@/server/tmdb/ingest/tv-show";
import {
	fetchMangaDexById,
	fetchMangaDexStatistics,
} from "@/server/mangadex/client";
import { updateMangaFromMangaDex } from "@/server/mangadex/ingest/manga";
import { fetchIgdbGameById } from "@/server/igdb/client";
import { updateGameFromIgdb } from "@/server/igdb/ingest/game";
import { EnrichmentStatus, MediaType } from "@prisma/client";

async function main() {
	const mediaList = await db.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.PENDING,
			type: MediaType.GAME,
		},
		take: 100,
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
			} else if (media.type === MediaType.MANGA) {
				const data = await fetchMangaDexById(media.externalId);
				const statistics = await fetchMangaDexStatistics(media.externalId);
				await updateMangaFromMangaDex(data, statistics);
			} else if (media.type === MediaType.GAME) {
				const data = await fetchIgdbGameById(media.externalId);
				await updateGameFromIgdb(data);
			} else {
				// COMIC isn't sourced from an API yet — no ingest path for it.
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
