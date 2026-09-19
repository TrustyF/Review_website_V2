import { db } from "@/server/db/client";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import { displayName } from "@/lib/display-name";
import NewAccountAlertEmail from "@/emails/new-account-alert-email";

// Fired right after account creation (credentials signup, or NextAuth's
// `createUser` event for OAuth). Fans out to every ADMIN.
export async function sendNewAccountAlert(newUser: {
	id?: string | null | undefined;
	name?: string | null | undefined;
	email?: string | null | undefined;
}): Promise<void> {
	const admins = await db.user.findMany({
		where: { role: "ADMIN", email: { not: null } },
		select: { email: true },
	});
	if (admins.length === 0) return;

	const name = displayName({ ...newUser, id: newUser.id ?? undefined });
	const userUrl = newUser.id
		? toAbsoluteUrl(`/admin/users/${newUser.id}`)
		: toAbsoluteUrl("/admin/users");

	await Promise.all(
		admins.map((admin) =>
			sendEmail({
				to: admin.email!,
				subject: `New account: ${name}`,
				react: NewAccountAlertEmail({
					name,
					email: newUser.email ?? "—",
					userUrl,
				}),
			}),
		),
	);
}
