import { getRecentRewatchesAndRatingChanges } from "@/components/activity/activity-actions";
import { ActivityFeed } from "@/components/activity/activity-feed/activity-feed";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "@/components/home/home-section.module.sass";

// Latest rewatches and rating changes, a slice of /activity — fetches its own data so it can stream in behind a Suspense boundary.
export async function ActivitySection() {
	const [entries, dict] = await Promise.all([
		getRecentRewatchesAndRatingChanges(),
		getDictionary(),
	]);
	if (entries.length === 0) return null;

	return (
		<section className={styles.wrapper}>
			<HomeSectionHeader
				title={dict.nav.activity}
				seeAll={{ href: "/activity", label: dict.home.seeAll }}
			/>
			<div className={styles.body}>
				<ActivityFeed entries={entries} />
			</div>
		</section>
	);
}
