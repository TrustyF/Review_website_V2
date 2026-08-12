import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { AccountSettingsForm } from "@/components/account/account-settings-form/account-settings-form";
import styles from "./account.module.sass";

export default async function AccountPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: {
			email: true,
			name: true,
			role: true,
			preferredLanguage: true,
			newsletterOptIn: true,
		},
	});
	if (!user) redirect("/login");

	return (
		<div className={styles.wrapper}>
			<h1>Account</h1>
			<p className={styles.identity}>
				{user.name ? `${user.name} — ` : ""}
				{user.email}
			</p>
			<p className={styles.role}>{user.role === "ADMIN" ? "Admin" : "Member"}</p>
			<AccountSettingsForm
				initial={{
					preferredLanguage: user.preferredLanguage,
					newsletterOptIn: user.newsletterOptIn,
				}}
			/>
		</div>
	);
}
