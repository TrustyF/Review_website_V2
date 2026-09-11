import { db } from "@/server/db/client";
import { posterUrlFor } from "@/server/resolvers/poster-resolver";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { PosterScalingPlayground } from "./poster-scaling-playground";

export default async function PosterScalingDevPage() {
	// Just a reasonable default so the page isn't empty on load — MediaBrowser (see
	// poster-scaling-playground.tsx) is how the poster under test actually gets picked.
	const initial = await db.media.findFirst({
		where: { posterPath: { not: null } },
		select: { id: true, title: true, type: true, externalId: true, posterPath: true },
		orderBy: { id: "desc" },
	});

	const initialPoster = initial
		? {
				id: initial.id,
				title: initial.title,
				fullUrl: posterUrlFor(initial.type, initial.externalId, initial.posterPath!, "full"),
				thumbUrl: posterUrlFor(initial.type, initial.externalId, initial.posterPath!, "thumb"),
				ratio: posterRatioFor(initial.type),
			}
		: null;

	return <PosterScalingPlayground initialPoster={initialPoster} />;
}
