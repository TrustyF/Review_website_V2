import { loadReviewsPage } from "./all-reviews-query";
import { AllReviewsFeed } from "./all-reviews-feed";
import styles from "./all-reviews-list-page.module.sass";

// Every reviewed item on the site, sorted by review date — the unbounded
// version of what FeaturedReview's picker only ever shows a handful of. Only
// the first page is fetched here now (see all-reviews-query.ts's own
// PAGE_SIZE comment) — AllReviewsFeed is what fetches the rest as the page
// scrolls.
export async function AllReviewsListPage() {
	const { media, hasMore } = await loadReviewsPage(0);

	return (
		<div className={styles.wrapper}>
			<AllReviewsFeed initialMedia={media} initialHasMore={hasMore} />
		</div>
	);
}
