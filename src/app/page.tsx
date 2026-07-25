import { MediaCardResolver } from "@/components/media/media-card-resolver";
import { db } from "@/lib/prisma/db";
import { MediaRecord, toMediaRecord } from "@/components/media/types";
import style from "./page.module.sass";

export default async function MediaGridPage() {
	const rawList = await db.media.findMany({
		include: { movie: true, tvShow: true, review: true },
		where: { enrichmentStatus: "DONE" },
		take: 10,
		orderBy: { releaseDate: "desc" },
	});
	// convert raw prisma into typed object, filter null values out
	const mediaList = rawList
		.map(toMediaRecord)
		.filter((m): m is MediaRecord => m !== null);

	return (
		<div>
			<div>
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
