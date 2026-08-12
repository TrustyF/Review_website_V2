import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { AccountSettingsForm } from "@/components/account/account-settings-form/account-settings-form";
import styles from "./account.module.sass";

export default async function AccountPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// role comes straight off the session (JWT) — see auth.ts's own comment,
	// it deliberately only refreshes on sign-in. preferredLanguage/
	// newsletterOptIn read from the DB instead of the session, though:
	// updateAccountSettings writes those straight to the DB without touching
	// the JWT, so reading them from the session here would show this page's
	// own form disagreeing with whatever the user just saved on it.
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { preferredLanguage: true, newsletterOptIn: true },
	});
	if (!user) redirect("/login");

	return (
		<div className={styles.wrapper}>
			<h1>Account</h1>
			<p className={styles.identity}>
				{session.user.name ? `${session.user.name} — ` : ""}
				{session.user.email}
			</p>
			<p className={styles.role}>
				{session.user.role === "ADMIN" ? "Admin" : "Member"}
			</p>
			<AccountSettingsForm
				initial={{
					preferredLanguage: user.preferredLanguage,
					newsletterOptIn: user.newsletterOptIn,
				}}
			/>
		</div>
	);
}
