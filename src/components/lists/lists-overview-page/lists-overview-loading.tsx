import { SkeletonBar, SkeletonCardGrid } from "@/components/ui/skeleton/skeleton";
import styles from "./lists-overview-page.module.sass";

export function ListsOverviewLoading() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<SkeletonBar width="6rem" height="1.8rem" />
				<SkeletonBar width="5rem" height="1.5rem" />
			</div>
			<SkeletonCardGrid count={8} minWidth="220px" aspectRatio="16/9" />
		</div>
	);
}
