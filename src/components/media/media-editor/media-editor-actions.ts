"use server";
import { db } from "@/lib/prisma/db";
import { toMediaRecord } from "@/components/media/media-card/types";

export async function getMediaForEdit(mediaId: number) {
	const raw = await db.media.findFirstOrThrow({
		where: { id: mediaId },
		include: {
			movie: true,
			tvShow: true,
			review: true,
		},
	});
	return toMediaRecord(raw);
}
