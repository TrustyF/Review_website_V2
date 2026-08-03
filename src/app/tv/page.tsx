import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { RatedTierGrid } from "@/components/media/rated-tier-grid/rated-tier-grid";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import styles from "./movies.module.sass";

export default async function MoviesPage() {
	const rawList = await db.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			type: MediaType.TVSHOW,
		},
		include: { tvShow: true, review: true },
	});
	const movies = await Promise.all(rawList.map(toMediaRecord));

	return (
		<div className={styles.wrapper}>
			<h1>TV</h1>
			<RatedTierGrid media={movies} />
		</div>
	);
}
