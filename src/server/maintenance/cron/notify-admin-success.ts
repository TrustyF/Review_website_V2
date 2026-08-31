import { UserRole } from "@prisma/client";
import { db } from "@/server/db/client";
import { createNotification } from "@/components/notifications/notification-actions";

// Invoked on a successful cron run; mirrors notify-admin-failure.ts but created already-read so routine success doesn't bump the unread badge.
// `summary` comes from the job's appendJobSummary output, base64-encoded since tsx truncates multi-line CLI args to their first line.
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
