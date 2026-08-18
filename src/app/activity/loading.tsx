import { SkeletonBar } from "@/components/ui/skeleton/skeleton";
import styles from "./activity.module.sass";
import loadingStyles from "./activity-loading.module.sass";

// getActivityFeed (activity-actions.ts) merges 7 parallel queries and then
// resolves a poster thumb per entry (deduped by media id, see
// activity-actions.ts's posterSrcCache) — real work, no loading.tsx existed
// for it before this.
export default function ActivityLoading() {
	return (
		<div className={styles.wrapper}>
			{Array.from({ length: 10 }, (_, i) => (
				<div key={i} className={loadingStyles.row}>
					<div className={loadingStyles.thumb} />
					<SkeletonBar width="60%" height="1rem" />
				</div>
			))}
		</div>
	);
}
