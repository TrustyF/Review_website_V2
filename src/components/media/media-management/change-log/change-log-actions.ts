"use server";
import { db } from "@/server/db/client";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";

// Soft delete — greyed out until purge-deleted-change-log.ts removes it after RETENTION_DAYS.
// Also hides the row from /activity's RATING_CHANGED feed, which filters on the same deletedAt.
export async function deleteChangeLogEntry(id: number) {
	await requireAdmin();
	const { mediaId } = await db.mediaChangeLog.update({
		where: { id },
		data: { deletedAt: new Date() },
		select: { mediaId: true },
	});
	revalidatePath("/");
	revalidatePath("/activity");
	// Cached result includes soft-deleted rows too, so it needs its own invalidation.
	updateTag(mediaCacheTag(mediaId));
}
