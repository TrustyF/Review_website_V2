"use client";
import { useEffect, useRef, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-mini-card/media-mini-card-resolver";
import styles from "./lazy-media-grid.module.sass";

// Sized generously (well past a typical viewport's worth of ~110px cards)
// so the sentinel starts below the fold on ordinary screens — the initial
// batch filling the viewport on its own is what keeps the very first
// IntersectionObserver check from immediately firing a reveal (see below).
// Still far fewer than mounting an entire result set's worth of cards (and
// their client-side poster components) up front, which is what actually
// made hydrating a big page like /movies slow.
const BATCH_SIZE = 24;

type Props = {
	items: MediaRecord[];
};

// A grid that reveals more cards as the sentinel scrolls into view, instead
// of mounting every item up front. Shared by RatedTierGrid (one instance per
// tier) and MediaSearchGrid (one instance per search) — both hand it a list
// that can run into the hundreds.
export function LazyMediaGrid({ items }: Props) {
	const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Reset back to the first batch whenever the item list itself changes (a
	// new search result set, not just a re-render with the same list) —
	// otherwise a visibleCount grown from scrolling a broad query would carry
	// over and mount an unrelated result set all at once. Adjusted during
	// render (React's documented pattern for "reset state when a prop
	// changes") rather than in an effect, which would cost an extra render.
	const [prevItems, setPrevItems] = useState(items);
	if (items !== prevItems) {
		setPrevItems(items);
		setVisibleCount(BATCH_SIZE);
	}

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		// rootMargin gives it a head start — the next batch mounts while the
		// sentinel is still a bit below the viewport, not exactly at its edge.
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setVisibleCount((count) => Math.min(count + BATCH_SIZE, items.length));
			},
			{ rootMargin: "100px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [items.length]);

	return (
		<>
			<div className={styles.grid}>
				{items.slice(0, visibleCount).map((item) => (
					<MediaMiniCardResolver
						media={item}
						key={item.id}
					/>
				))}
			</div>
			{visibleCount < items.length && (
				<div
					className={styles.sentinel}
					ref={sentinelRef}
				/>
			)}
		</>
	);
}
