import { redirect } from "next/navigation";
import { Link } from "@/components/ui/link";
import { auth } from "@/auth";
import { getNotifications } from "@/components/notifications/notification-actions";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import styles from "./notifications.module.sass";

export default async function AccountNotificationsPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const notifications = await getNotifications();

	return (
		<div className={styles.wrapper}>
			<Link href="/account" className={styles.back_link}>
				← Account
			</Link>
			<h1>Notifications</h1>
			<NotificationFeed notifications={notifications} />
		</div>
	);
}
