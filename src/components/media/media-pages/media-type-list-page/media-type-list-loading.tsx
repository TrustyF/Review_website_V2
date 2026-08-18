import { SkeletonCardGrid } from "@/components/ui/skeleton/skeleton";
import styles from "./media-type-list-page.module.sass";

// Shared by every per-type catalog route's loading.tsx (books, comics,
// games, manga, movies, shorts, tv) — same wrapper styles.wrapper the real
// MediaTypeListPage renders into, so the swap-in doesn't jump.
export function MediaTypeListLoading() {
	return (
		<div className={styles.wrapper}>
			<SkeletonCardGrid count={21} minWidth="110px" />
		</div>
	);
}
