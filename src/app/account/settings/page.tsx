import { redirect } from "next/navigation";
import { Link } from "@/components/ui/link";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { AccountSettingsForm } from "@/components/account/account-settings-form/account-settings-form";
// import { DeleteAccountSection } from "@/components/account/delete-account-section/delete-account-section";
import styles from "./settings.module.sass";

export default async function AccountSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// Reads from DB, not session, since updateAccountSettings writes DB directly without refreshing the JWT.
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: {
			preferredLanguage: true,
			newsletterOptIn: true,
			username: true,
			passwordHash: true,
		},
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
					username: user.username,
				}}
			/>
			{/* Disabled for now — see this component's own file. */}
			{/* <DeleteAccountSection hasPassword={user.passwordHash !== null} /> */}
		</div>
	);
}
