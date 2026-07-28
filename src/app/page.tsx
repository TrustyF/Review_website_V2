import { MediaCardResolver } from "@/components/media/media-card/media-card-resolver";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import styles from "./styles/page.module.sass";
import { EnrichmentStatus } from "@prisma/client";

export default async function MediaGridPage() {
	const rawList = await db.media.findMany({
		include: { movie: true, tvShow: true, review: true },
		where: { enrichmentStatus: EnrichmentStatus.DONE },
		take: 20,
		orderBy: { releaseDate: "desc" },
	});
	// convert raw prisma into typed, display-ready objects (posters resolved)
	const mediaList = await Promise.all(rawList.map(toMediaRecord));

	return (
		<div className={styles.wrapper}>
			<div className={styles.mediaList}>
				{mediaList.map((media) => (
					<MediaCardResolver
						media={media}
						key={media.id}
					/>
				))}
			</div>
		</div>
	);
}
