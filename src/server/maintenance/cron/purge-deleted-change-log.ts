import { db } from "@/server/db/client";
import { appendJobSummary } from "./job-summary";

// How long a soft-deleted entry stays visible (greyed out) before this
// script permanently removes it — see change-log-actions.ts.
const RETENTION_DAYS = 1;

// Permanently removes change log entries soft-deleted more than RETENTION_DAYS ago.
async function main() {
	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

	const { count } = await db.mediaChangeLog.deleteMany({
		where: { deletedAt: { lt: cutoff } },
	});

	const summary = `Purged ${count} change log entr${count === 1 ? "y" : "ies"} deleted more than ${RETENTION_DAYS} days ago.`;
	console.log(summary);
	await appendJobSummary(["## Purge Deleted Changelogs", "", summary]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
