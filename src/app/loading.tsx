import { SkeletonBar, SkeletonCardGrid } from "@/components/ui/skeleton/skeleton";
import pageStyles from "./page.module.sass";
import styles from "./home-loading.module.sass";

// HomePage's own 4 queries are already correctly parallelized via
// Promise.all (see page.tsx) — this only adds the missing streaming
// boundary, no query changes needed.
export default function HomeLoading() {
	return (
		<div className={pageStyles.wrapper}>
			<div className={styles.hero} />
			<div className={styles.section}>
				<SkeletonBar width="10rem" height="1.2rem" />
				<SkeletonCardGrid count={14} minWidth="110px" />
			</div>
			<div className={styles.section}>
				<SkeletonBar width="12rem" height="1.2rem" />
				<SkeletonCardGrid count={14} minWidth="110px" />
			</div>
			<div className={styles.section}>
				<SkeletonBar width="11rem" height="1.2rem" />
				<SkeletonCardGrid count={14} minWidth="110px" />
			</div>
		</div>
	);
}
