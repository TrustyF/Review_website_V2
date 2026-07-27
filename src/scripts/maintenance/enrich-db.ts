import { db } from "@/lib/prisma/db";
import { fetchTmdbById } from "@/lib/tmdb/request";
import { updateMovieFromTmdb } from "@/lib/tmdb/update-script";
import { MediaType } from "@prisma/client";

async function main() {
	const mediaList = await db.media.findMany({
		where: { enrichmentStatus: "PENDING" },
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
