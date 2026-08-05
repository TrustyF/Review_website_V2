"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";

// Soft delete — the row stays in the log (greyed out, see
// change-log-entry-row.tsx) until purge-deleted-change-log.ts removes it
// during maintenance, RETENTION_DAYS after this call.
export async function deleteChangeLogEntry(id: number) {
	await db.mediaChangeLog.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
	revalidatePath("/");
}
