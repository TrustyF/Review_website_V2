import { UserRole } from "@prisma/client";
import { db } from "@/server/db/client";
import { createNotification } from "@/components/notifications/notification-actions";

// Invoked by run-and-notify.sh on a successful (zero-exit) cron job run —
// mirrors notify-admin-failure.ts, but created already-read (see
// createNotification's markAsRead) so a routine success doesn't bump the
// unread badge the way an actual failure should; it's still visible in the
// notification list for anyone who wants a paper trail of what ran.
//
// `summary` is whatever the job's own appendJobSummary calls produced (see
// job-summary.ts's SUMMARY_START/END markers and run-and-notify.sh's own
// extraction of them) — optional since not every job necessarily calls
// appendJobSummary, or a run could produce an empty summary. base64 — tsx
// silently truncates a multi-line CLI argument to its first line, and a
// job summary is almost always multi-line; see run-and-notify.sh's own
// comment on this.
async function main() {
	const jobName = process.argv[2];
	const summaryB64 = process.argv[3];
	const summary = summaryB64
		? Buffer.from(summaryB64, "base64").toString("utf-8").trim()
		: "";
	if (!jobName) {
		console.error(
			"Usage: tsx notify-admin-success.ts <job-name> [base64-summary]",
		);
		process.exit(1);
	}

	const message = summary ? `${jobName}\n\n${summary}` : jobName;

	const admins = await db.user.findMany({ where: { role: UserRole.ADMIN } });
	for (const admin of admins) {
		await createNotification({
			type: "CRON_JOB_SUCCEEDED",
			userId: admin.id,
			message,
			markAsRead: true,
		});
	}
	console.log(`Notified ${admins.length} admin(s) of ${jobName}'s success.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
