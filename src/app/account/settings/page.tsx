import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { AccountSettingsForm } from "@/components/account/account-settings-form/account-settings-form";
import styles from "./settings.module.sass";

export default async function AccountSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// Same reasoning as /account's own user query — updateAccountSettings
	// writes straight to the DB without touching the JWT, so this form has to
	// read its initial values from there too, not the session.
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { preferredLanguage: true, newsletterOptIn: true },
	});
	if (!user) redirect("/login");

	return (
		<div className={styles.wrapper}>
			<Link href="/account" className={styles.back_link}>
				← Account
			</Link>
			<h1>Settings</h1>
			<AccountSettingsForm
				initial={{
					preferredLanguage: user.preferredLanguage,
					newsletterOptIn: user.newsletterOptIn,
				}}
			/>
		</div>
	);
}
