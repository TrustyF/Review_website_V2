import { db } from "@/server/db/client";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import { displayName } from "@/lib/display-name";
import RecommendationRequestAlertEmail from "@/emails/recommendation-request-alert-email";

// Fired inline (not a cron job) — a one-off ops alert, not a batched digest.
// Fans out to every ADMIN; the app doesn't assume there's only one.
export async function sendRecommendationRequestAlert(requestId: number): Promise<void> {
	const [request, admins] = await Promise.all([
		db.recommendationRequest.findUniqueOrThrow({
			where: { id: requestId },
			select: {
				message: true,
				user: { select: { username: true, name: true, email: true, id: true } },
			},
		}),
		db.user.findMany({
			where: { role: "ADMIN", email: { not: null } },
			select: { email: true },
		}),
	]);
	if (admins.length === 0) return;

	const requesterName = displayName(request.user);
	const requestUrl = toAbsoluteUrl("/admin/recommendation-requests");

	await Promise.all(
		admins.map((admin) =>
			sendEmail({
				to: admin.email!,
				subject: `New recommendation request from ${requesterName}`,
				react: RecommendationRequestAlertEmail({
					requesterName,
					message: request.message,
					requestUrl,
				}),
			}),
		),
	);
}
