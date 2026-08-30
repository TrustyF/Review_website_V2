import { UserRole } from "@prisma/client";
import { db } from "@/server/db/client";
import { createNotification } from "@/components/notifications/notification-actions";

// Invoked by run-and-notify.sh on any non-zero exit from a cron job — not
// just an uncaught exception in the job's own .ts file, since that wrapper
// wraps the whole command (docker build/run failures included). One
// Notification per ADMIN user, same "there could be more than one" stance
// as the rest of the codebase's role: "ADMIN" lookups.
async function main() {
	const jobName = process.argv[2];
	// base64 — tsx silently truncates a multi-line CLI argument to its first
	// line, and this log tail is almost always multi-line; see
	// run-and-notify.sh's own comment on the same fix for notify_cron_success.
	const messageB64 = process.argv[3];
	if (!jobName || !messageB64) {
		console.error(
			"Usage: tsx notify-admin-failure.ts <job-name> <base64-message>",
		);
		process.exit(1);
	}
	const message = Buffer.from(messageB64, "base64").toString("utf-8");

	const admins = await db.user.findMany({ where: { role: UserRole.ADMIN } });
	for (const admin of admins) {
		await createNotification({
			type: "CRON_JOB_FAILED",
			userId: admin.id,
			message: `${jobName}: ${message}`,
		});
	}
	console.log(`Notified ${admins.length} admin(s) of ${jobName}'s failure.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
