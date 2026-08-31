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

// Fetches each page after the first as the sentinel scrolls into view, appending and re-grouping by month. Unlike useLazyReveal, there's no hidden tail — every item here was fetched because it's about to show.
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

		// rootMargin starts the fetch a bit before the sentinel reaches the viewport edge.
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
