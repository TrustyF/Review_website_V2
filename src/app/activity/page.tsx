import { getActivityFeed } from "@/components/activity/activity-actions";
import { ActivityFeed } from "@/components/activity/activity-feed/activity-feed";
import { ActivityIcon } from "@/components/icons/activity-icon";
import styles from "./activity.module.sass";

export default async function ActivityPage() {
	const entries = await getActivityFeed();

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<ActivityIcon size={28} className={styles.title_icon} />
					Activity
				</h1>
			</div>
			<ActivityFeed entries={entries} />
		</div>
	);
}
