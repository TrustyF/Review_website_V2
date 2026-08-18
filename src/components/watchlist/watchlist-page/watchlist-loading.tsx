import { SkeletonBar, SkeletonCardGrid } from "@/components/ui/skeleton/skeleton";
import styles from "./watchlist-page.module.sass";

export function WatchlistLoading() {
	return (
		<div className={styles.wrapper}>
			<SkeletonBar width="10rem" height="1.8rem" />
			<SkeletonCardGrid count={14} minWidth="150px" />
		</div>
	);
}
