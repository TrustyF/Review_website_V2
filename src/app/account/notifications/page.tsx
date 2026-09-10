import { redirect } from "next/navigation";
import { Link } from "@/components/ui/link";
import { auth } from "@/auth";
import { getNotifications } from "@/components/notifications/notification-actions";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./notifications.module.sass";

export default async function AccountNotificationsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const [notifications, dict] = await Promise.all([
		getNotifications(),
		getDictionary(),
	]);

	return (
		<div className={styles.wrapper}>
			<Link href="/account" className={styles.back_link}>
				{dict.notifications.backToAccount}
			</Link>
			<h1>{dict.notifications.title}</h1>
			<NotificationFeed notifications={notifications} />
		</div>
	);
}
