"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { GroupedMediaList } from "@/components/media/media-grids/grouped-media-list/grouped-media-list";
import { groupMediaByReviewMonth } from "./group-by-review-month";
import { loadMoreReviews } from "./all-reviews-actions";
import styles from "./all-reviews-feed.module.sass";

type Props = {
	initialMedia: MediaRecord[];
	initialHasMore: boolean;
};

// Drives the actual pagination: AllReviewsListPage only ever fetches the
// first page server-side (see all-reviews-actions.ts's own comment on why),
// so this is what fetches each subsequent one as the sentinel scrolls into
// view, appending it to what's already loaded and re-grouping the whole
// accumulated list by month. Unlike LazyMediaGrid/LazyMediaList's
// useLazyReveal, there's no hidden tail to reveal here — every item this
// renders was fetched because it's about to be shown.
export function AllReviewsFeed({ initialMedia, initialHasMore }: Props) {
	const [media, setMedia] = useState(initialMedia);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const [loading, setLoading] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const groups = useMemo(() => groupMediaByReviewMonth(media), [media]);

	useEffect(() => {
		if (!hasMore) return;
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		// rootMargin gives it a head start — the next page starts fetching
		// while the sentinel is still a bit below the viewport, not exactly
		// at its edge. Same convention as useLazyReveal's own observer.
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();
				setLoading(true);
				loadMoreReviews(media.length).then(({ media: next, hasMore: more }) => {
					setMedia((current) => [...current, ...next]);
					setHasMore(more);
					setLoading(false);
				});
			},
			{ rootMargin: "200px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, media.length]);

	return (
		<>
			<GroupedMediaList groups={groups} />
			{hasMore && (
				<div className={styles.sentinel} ref={sentinelRef}>
					{loading && <div className={styles.spinner} />}
				</div>
			)}
		</>
	);
}
