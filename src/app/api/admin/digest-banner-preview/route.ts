import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { auth } from "@/auth";
import { buildDigestEmailProps } from "@/server/email/digest-email-props";
import LatestActivityEmail from "@/emails/latest-activity-email";

// Renders the real weekly-digest email (current banner override + latest
// activity) as static HTML, so /admin/digest-banner can preview it in an
// iframe without actually sending anything.
export async function GET() {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const props = await buildDigestEmailProps();
	if (!props) {
		return new NextResponse(
			"No rating/review activity in the past week — there's nothing to preview yet.",
			{ headers: { "Content-Type": "text/plain" } },
		);
	}

	const html = await render(LatestActivityEmail(props));
	return new NextResponse(html, {
		headers: { "Content-Type": "text/html" },
	});
}
