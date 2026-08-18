import { SkeletonBar } from "@/components/ui/skeleton/skeleton";
import pageStyles from "./all-reviews-list-page.module.sass";
import styles from "./all-reviews-list-loading.module.sass";

// AllReviewsListPage's query is a single, already-optimal round trip (see
// its own top comment — the biggest single query on the site, but not a
// fan-out) — this only adds the missing streaming boundary, no query
// changes needed. Rows mimic MediaCardShell's poster + text shape rather
// than a plain card grid, since that's what LazyMediaList actually renders.
export function AllReviewsListLoading() {
	return (
		<div className={pageStyles.wrapper}>
			{Array.from({ length: 5 }, (_, i) => (
				<div key={i} className={styles.row}>
					<div className={styles.poster} />
					<div className={styles.text_group}>
						<SkeletonBar width="14rem" height="1.3rem" />
						<SkeletonBar width="8rem" height="0.9rem" />
						<SkeletonBar width="100%" height="0.9rem" />
						<SkeletonBar width="90%" height="0.9rem" />
						<SkeletonBar width="60%" height="0.9rem" />
					</div>
				</div>
			))}
		</div>
	);
}
