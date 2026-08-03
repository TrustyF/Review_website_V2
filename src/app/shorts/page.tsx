import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { RatedTierGrid } from "@/components/media/rated-tier-grid/rated-tier-grid";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import styles from "./shorts.module.sass";

export default async function ShortsPage() {
	const rawList = await db.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			type: MediaType.SHORT,
		},
		include: { movie: true, review: true },
	});
	const shorts = await Promise.all(rawList.map(toMediaRecord));

	return (
		<div className={styles.wrapper}>
			<h1>Shorts</h1>
			<RatedTierGrid media={shorts} />
		</div>
	);
}
