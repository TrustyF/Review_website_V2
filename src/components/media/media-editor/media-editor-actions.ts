"use server";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { resolvePoster } from "@/server/resolvers/poster-resolver";

export async function getMediaForEdit(mediaId: number) {
	const raw = await db.media.findFirstOrThrow({
		where: { id: mediaId },
		include: {
			movie: true,
			tvShow: true,
			review: true,
		},
	});
	const media = toMediaRecord(raw);
	const posterSrc = await resolvePoster(media.id, media.posterPath);
	return { media, posterSrc };
}
