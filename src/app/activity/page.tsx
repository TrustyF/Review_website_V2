import { getActivityFeed } from "@/components/activity/activity-actions";
import { ActivityFeed } from "@/components/activity/activity-feed/activity-feed";
import styles from "./activity.module.sass";

export default async function ActivityPage() {
	const entries = await getActivityFeed();

	return (
		<div className={styles.wrapper}>
			{/*<h1>Activity</h1>*/}
			<ActivityFeed entries={entries} />
		</div>
	);
}
