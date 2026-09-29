import { redirect } from "next/navigation";
import { Link } from "@/components/ui/link";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AccountSettingsForm } from "@/components/account/account-settings-form/account-settings-form";
import { SignOutButton } from "@/components/account/sign-out-button/sign-out-button";
// import { DeleteAccountSection } from "@/components/account/delete-account-section/delete-account-section";
import styles from "./settings.module.sass";

export default async function AccountSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// Reads from DB, not session, since updateAccountSettings writes DB directly without refreshing the JWT.
	const [user, dict] = await Promise.all([
		db.user.findUnique({
			where: { id: session.user.id },
			select: {
				preferredLanguage: true,
				newsletterOptIn: true,
				listAddEmailOptIn: true,
				username: true,
				passwordHash: true,
			},
		}),
		getDictionary(),
	]);
	if (!user) redirect("/login");

	return (
		<div className={styles.wrapper}>
			<Link href="/account" className={styles.back_link}>
				{dict.account.backToAccount}
			</Link>
			<h1>{dict.account.settingsTitle}</h1>
			<AccountSettingsForm
				initial={{
					preferredLanguage: user.preferredLanguage,
					newsletterOptIn: user.newsletterOptIn,
					listAddEmailOptIn: user.listAddEmailOptIn,
					username: user.username,
				}}
			/>
			<div className={styles.sign_out}>
				<SignOutButton />
			</div>
			{/* Disabled for now — see this component's own file. */}
			{/* <DeleteAccountSection hasPassword={user.passwordHash !== null} /> */}
		</div>
	);
}
