import { LayoutList } from "lucide-react";
import { loadReviewsPage } from "./all-reviews-query";
import { AllReviewsFeed } from "./all-reviews-feed";
import styles from "./all-reviews-list-page.module.sass";

// Every reviewed item, sorted by review date. Only the first page is fetched here; AllReviewsFeed fetches the rest as the page scrolls.
export async function AllReviewsListPage() {
	const { media, hasMore } = await loadReviewsPage(0);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<LayoutList size={20} className={styles.title_icon} />
					Reviews
				</h1>
			</div>
			<AllReviewsFeed initialMedia={media} initialHasMore={hasMore} />
		</div>
	);
}
