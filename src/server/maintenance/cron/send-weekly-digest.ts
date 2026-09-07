import { db } from "@/server/db/client";
import { sendWeeklyDigest } from "@/server/email/send-weekly-digest";
import { appendJobSummary, formatSummaryList } from "./job-summary";

async function main() {
	const result = await sendWeeklyDigest();
	if (!result.sent) {
		await appendJobSummary([
			"No rating/review activity in the past week — skipped.",
		]);
		return;
	}

	await appendJobSummary([
		`Sent weekly digest to ${result.recipientCount} subscriber(s).`,
		...formatSummaryList(result.titles),
	]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
