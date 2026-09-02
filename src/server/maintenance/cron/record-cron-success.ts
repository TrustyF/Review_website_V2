import { db } from "@/server/db/client";

// Invoked on a successful cron run; mirrors record-cron-failure.ts. Records
// a CronJobRun row for /admin/logs.
// `summary` comes from the job's appendJobSummary output, base64-encoded since tsx truncates multi-line CLI args to their first line.
async function main() {
	const jobName = process.argv[2];
	const summaryB64 = process.argv[3];
	const summary = summaryB64
		? Buffer.from(summaryB64, "base64").toString("utf-8").trim()
		: "";
	if (!jobName) {
		console.error(
			"Usage: tsx record-cron-success.ts <job-name> [base64-summary]",
		);
		process.exit(1);
	}

	await db.cronJobRun.create({
		data: { jobName, status: "SUCCESS", summary },
	});
	console.log(`Recorded ${jobName}'s success.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
