import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { auth } from "@/auth";
import { buildDigestEmailProps } from "@/server/email/digest-email-props";
import { buildUnsubscribeToken } from "@/server/email/unsubscribe-token";
import { toAbsoluteUrl } from "@/server/email/mailer";
import LatestActivityEmail from "@/emails/latest-activity-email";
import { getLocale } from "@/lib/i18n/get-locale";

// Renders weekly-digest email as static HTML for iframe preview.
export async function GET() {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	// getLocale() (cookie-first), not session.user.preferredLanguage directly —
	// the JWT session only refreshes at sign-in, same as elsewhere in the app.
	const locale = await getLocale();
	const props = await buildDigestEmailProps(locale);
	if (!props) {
		return new NextResponse(
			"No rating/review activity in the past week — there's nothing to preview yet.",
			{ headers: { "Content-Type": "text/plain" } },
		);
	}

	const unsubscribeUrl = toAbsoluteUrl(
		`/api/unsubscribe?token=${buildUnsubscribeToken(session.user.id, "newsletterOptIn")}`,
	);
	const html = await render(LatestActivityEmail({ ...props, unsubscribeUrl }));
	return new NextResponse(html, {
		headers: { "Content-Type": "text/html" },
	});
}
