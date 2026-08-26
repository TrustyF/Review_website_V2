"use server";
import { db } from "@/server/db/client";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";

// Soft delete — the row stays in the log (greyed out, see
// change-log-entry-row.tsx) until purge-deleted-change-log.ts removes it
// during maintenance, RETENTION_DAYS after this call. A "rating" row is also
// /activity's own RATING_CHANGED source (see activity-actions.ts's
// getActivityFeed, which filters on this same deletedAt) — hiding it here
// hides it there too, for free, with no second write to keep in sync.
export async function deleteChangeLogEntry(id: number) {
	await requireAdmin();
	const { mediaId } = await db.mediaChangeLog.update({
		where: { id },
		data: { deletedAt: new Date() },
		select: { mediaId: true },
	});
	revalidatePath("/");
	revalidatePath("/activity");
	// getMediaChangeLog's cached result (get-media.ts) includes soft-deleted
	// rows too — see change-log-entry-row.tsx — so it needs its own
	// invalidation, same reasoning as updateMediaBannerFocus.
	updateTag(mediaCacheTag(mediaId));
}
