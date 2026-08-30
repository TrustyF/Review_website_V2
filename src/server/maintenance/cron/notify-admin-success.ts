import { UserRole } from "@prisma/client";
import { db } from "@/server/db/client";
import { createNotification } from "@/components/notifications/notification-actions";

// Invoked by run-and-notify.sh on a successful (zero-exit) cron job run —
// mirrors notify-admin-failure.ts, but created already-read (see
// createNotification's markAsRead) so a routine success doesn't bump the
// unread badge the way an actual failure should; it's still visible in the
// notification list for anyone who wants a paper trail of what ran.
async function main() {
	const jobName = process.argv[2];
	if (!jobName) {
		console.error("Usage: tsx notify-admin-success.ts <job-name>");
		process.exit(1);
	}

	const admins = await db.user.findMany({ where: { role: UserRole.ADMIN } });
	for (const admin of admins) {
		await createNotification({
			type: "CRON_JOB_SUCCEEDED",
			userId: admin.id,
			message: jobName,
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
