"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

// Soft delete — the row stays in the log (greyed out, see
// change-log-entry-row.tsx) until purge-deleted-change-log.ts removes it
// during maintenance, RETENTION_DAYS after this call. A "rating" row is also
// /activity's own RATING_CHANGED source (see activity-actions.ts's
// getActivityFeed, which filters on this same deletedAt) — hiding it here
// hides it there too, for free, with no second write to keep in sync.
export async function deleteChangeLogEntry(id: number) {
	await requireAdmin();
	await db.mediaChangeLog.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	revalidatePath("/");
	revalidatePath("/activity");
}
