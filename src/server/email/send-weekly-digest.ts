import { db } from "@/server/db/client";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import { buildDigestEmailProps } from "@/server/email/digest-email-props";
import { buildUnsubscribeToken } from "@/server/email/unsubscribe-token";
import LatestActivityEmail from "@/emails/latest-activity-email";

export type WeeklyDigestResult =
	| { sent: false }
	| { sent: true; recipientCount: number; titles: string[] };

// Shared by the cron script and the admin "send now" action, so both go
// through the exact same recipient query/send path.
export async function sendWeeklyDigest(): Promise<WeeklyDigestResult> {
	const props = await buildDigestEmailProps();
	if (!props) return { sent: false };

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

	return {
		sent: true,
		recipientCount: recipients.length,
		titles: props.recentWatches.map((w) => w.title),
	};
}
