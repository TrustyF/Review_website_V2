import { SkeletonCardGrid } from "@/components/ui/skeleton/skeleton";
import styles from "@/components/media/media-pages/recent-media-list-page/recent-media-list-page.module.sass";

export default function RecentMoviesLoading() {
	return (
		<div className={styles.wrapper}>
			<SkeletonCardGrid count={21} minWidth="110px" />
		</div>
	);
}
