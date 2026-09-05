import { db } from "@/server/db/client";

// Records CronJobRun; summary base64-encoded (tsx truncates multi-line args)
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
