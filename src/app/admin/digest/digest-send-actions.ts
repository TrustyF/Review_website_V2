"use server";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendWeeklyDigest } from "@/server/email/send-weekly-digest";
import { formatSummaryList } from "@/server/maintenance/cron/job-summary";

// Same jobName as the (now unscheduled) cron script, so this still shows up
// in /admin/logs the same way a cron run would.
const JOB_NAME = "weekly_digest";

export type SendDigestResult =
	| { sent: false }
	| { sent: true; recipientCount: number };

export async function sendWeeklyDigestNow(): Promise<SendDigestResult> {
	await requireAdmin();

	try {
		const result = await sendWeeklyDigest();
		if (!result.sent) {
			await db.cronJobRun.create({
				data: {
					jobName: JOB_NAME,
					status: "SUCCESS",
					summary:
						"No rating/review activity in the past week — skipped. (manual send)",
				},
			});
			return { sent: false };
		}

		await db.cronJobRun.create({
			data: {
				jobName: JOB_NAME,
				status: "SUCCESS",
				summary: [
					`Sent weekly digest to ${result.recipientCount} subscriber(s). (manual send)`,
					...formatSummaryList(result.titles),
				].join("\n"),
			},
		});
		return { sent: true, recipientCount: result.recipientCount };
	} catch (e) {
		await db.cronJobRun.create({
			data: {
				jobName: JOB_NAME,
				status: "FAILURE",
				summary: `${e instanceof Error ? e.message : String(e)} (manual send)`,
			},
		});
		throw e;
	}
}
