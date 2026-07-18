import { MediaCardResolver } from "@/components/media/media-card-resolver";
import { db } from "@/lib/prisma/db";
import style from "./page.module.sass";

export default async function MediaGridPage() {
	const mediaList = await db.media.findMany({
		include: { movie: true, tvShow: true },
		where: { enrichmentStatus: "DONE" },
		take: 10,
		orderBy: { releaseDate: "desc" },
	});

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
