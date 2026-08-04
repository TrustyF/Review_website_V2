import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { RatedTierGrid } from "@/components/media/rated-tier-grid/rated-tier-grid";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import styles from "./movies.module.sass";

export default async function GamesPage() {
	const rawList = await db.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			type: MediaType.GAME,
		},
		include: { game: true, review: true },
	});
	const games = await Promise.all(rawList.map(toMediaRecord));

	return (
		<div className={styles.wrapper}>
			<h1>Games</h1>
			<RatedTierGrid media={games} />
		</div>
	);
}
