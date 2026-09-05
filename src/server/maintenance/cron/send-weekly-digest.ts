import { db } from "@/server/db/client";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import { buildDigestEmailProps } from "@/server/email/digest-email-props";
import { buildUnsubscribeToken } from "@/server/email/unsubscribe-token";
import LatestActivityEmail from "@/emails/latest-activity-email";
import { appendJobSummary, formatSummaryList } from "./job-summary";

async function main() {
	const props = await buildDigestEmailProps();
	if (!props) {
		await appendJobSummary([
			"No rating/review activity in the past week — skipped.",
		]);
		return;
	}

	const recipients = await db.user.findMany({
		where: { newsletterOptIn: true, email: { not: null } },
		select: { id: true, email: true },
	});

	for (const recipient of recipients) {
		const unsubscribeUrl = toAbsoluteUrl(
			`/api/unsubscribe?token=${buildUnsubscribeToken(recipient.id, "newsletterOptIn")}`,
		);
		await sendEmail({
			to: recipient.email!,
			subject: "What I've been watching",
			react: LatestActivityEmail({ ...props, unsubscribeUrl }),
		});
	}

	await appendJobSummary([
		`Sent weekly digest to ${recipients.length} subscriber(s).`,
		...formatSummaryList(props.recentWatches.map((w) => w.title)),
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
