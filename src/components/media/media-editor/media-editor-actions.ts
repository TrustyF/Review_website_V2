"use server";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { revalidatePath } from "next/cache";

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

export async function saveReview(
	mediaId: number,
	review: {
		rating: number | null;
		liked: boolean;
		difficulty: number;
		body: string | null;
	},
) {
	await db.review.upsert({
		where: { mediaId },
		update: review,
		create: { mediaId, ...review },
	});
	revalidatePath("/");
}
