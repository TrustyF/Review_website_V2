import { SkeletonBar, SkeletonCardGrid } from "@/components/ui/skeleton/skeleton";
import styles from "./list-detail-page.module.sass";

export function ListDetailLoading() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<SkeletonBar
					width="220px"
					height="123.75px"
					className={styles.thumbnail}
				/>
				<div className={styles.header_info}>
					<SkeletonBar width="14rem" height="1.8rem" />
					<SkeletonBar width="20rem" height="1rem" />
				</div>
			</div>
			<SkeletonCardGrid count={14} minWidth="150px" />
		</div>
	);
}
