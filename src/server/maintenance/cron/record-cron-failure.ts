import { db } from "@/server/db/client";

// Invoked by run-and-notify.sh on any non-zero exit from a cron job (docker
// build/run failures included, not just an uncaught exception). Records a
// CronJobRun row for /admin/logs.
async function main() {
	const jobName = process.argv[2];
	// base64: tsx truncates a multi-line CLI argument to its first line, and this log tail is usually multi-line.
	const messageB64 = process.argv[3];
	if (!jobName || !messageB64) {
		console.error(
			"Usage: tsx record-cron-failure.ts <job-name> <base64-message>",
		);
		process.exit(1);
	}
	const summary = Buffer.from(messageB64, "base64").toString("utf-8");

	await db.cronJobRun.create({
		data: { jobName, status: "FAILURE", summary },
	});
	console.log(`Recorded ${jobName}'s failure.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
