import { db } from "@/server/db/client";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import {
	buildDigestEmailProps,
	DigestEmailProps,
} from "@/server/email/digest-email-props";
import { buildUnsubscribeToken } from "@/server/email/unsubscribe-token";
import LatestActivityEmail from "@/emails/latest-activity-email";
import { isLocale, type Locale } from "@/lib/i18n/get-locale";

export type WeeklyDigestResult =
	| { sent: false }
	| { sent: true; recipientCount: number; titles: string[] };

// Shared by the cron script and the admin "send now" action, so both go
// through the exact same recipient query/send path.
export async function sendWeeklyDigest(): Promise<WeeklyDigestResult> {
	const recipients = await db.user.findMany({
		where: { newsletterOptIn: true, email: { not: null } },
		select: { id: true, email: true, preferredLanguage: true },
	});
	if (recipients.length === 0) return { sent: false };

	// Content is otherwise identical for everyone — build it once per locale
	// actually present among recipients, not once per recipient.
	const propsByLocale = new Map<Locale, DigestEmailProps | null>();
	async function propsFor(locale: Locale): Promise<DigestEmailProps | null> {
		if (!propsByLocale.has(locale)) {
			propsByLocale.set(locale, await buildDigestEmailProps(locale));
		}
		return propsByLocale.get(locale) ?? null;
	}

	let sentCount = 0;
	let anyProps: DigestEmailProps | null = null;
	for (const recipient of recipients) {
		const locale: Locale = isLocale(recipient.preferredLanguage)
			? recipient.preferredLanguage
			: "en";
		const props = await propsFor(locale);
		if (!props) continue;
		anyProps ??= props;

		const unsubscribeUrl = toAbsoluteUrl(
			`/api/unsubscribe?token=${buildUnsubscribeToken(recipient.id, "newsletterOptIn")}`,
		);
		await sendEmail({
			to: recipient.email!,
			subject: props.dict.digest.subject,
			react: LatestActivityEmail({ ...props, unsubscribeUrl }),
		});
		sentCount++;
	}

	if (!anyProps) return { sent: false };
	return {
		sent: true,
		recipientCount: sentCount,
		titles: anyProps.recentWatches.map((w) => w.title),
	};
}
