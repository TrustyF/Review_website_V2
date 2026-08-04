"use client";
import { useEffect, useRef, useState } from "react";
import { MediaRecord } from "@/components/media/media-card/types";
import { MediaMiniCardResolver } from "@/components/media/media-card/cards-mini/media-mini-card-resolver";
import styles from "./rated-tier-grid.module.sass";

// Buckets media into whole-point rating tiers (9 covers a 9.0-9.5 rating,
// etc.) — halfway steps would mean twenty collapsible sections, too many to
// be useful as a grid overview. Unrated media get their own tier at the end
// rather than being silently dropped.
function ratingTierOf(media: MediaRecord): number | null {
	const rating = media.review?.rating;
	if (rating == null) return null;
	return Math.floor(rating);
}

function tierLabel(tier: number | null): string {
	if (tier === null) return "Unrated";
	if (tier >= 10) return "10";
	return `${tier}–${tier + 1}`;
}

// Sized generously (well past a typical viewport's worth of ~120px cards)
// so the sentinel starts below the fold on ordinary screens — the initial
// batch filling the viewport on its own is what keeps the very first
// IntersectionObserver check from immediately firing a reveal (see below).
// Still far fewer than mounting an entire tier's worth of cards (and their
// client-side poster components) up front, which is what actually made
// hydrating a big page like /movies slow.
const BATCH_SIZE = 24;

// One tier's grid — owns its own reveal-more-on-scroll state so opening/
// scrolling one tier doesn't affect the others.
function LazyTierGrid({ items }: { items: MediaRecord[] }) {
	const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
	const sentinelRef = useRef<HTMLDivElement>(null);

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
			<div className={styles.tier_grid}>
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

type Props = {
	media: MediaRecord[];
};

// Groups media into rating tiers, highest first (Unrated last), each
// rendered as a collapsible, lazily-revealed grid of mini cards.
export function RatedTierGrid({ media }: Props) {
	const sorted = [...media].sort(
		(a, b) => (b.review?.rating ?? -1) - (a.review?.rating ?? -1),
	);

	const tiers = new Map<number | null, MediaRecord[]>();
	for (const item of sorted) {
		const tier = ratingTierOf(item);
		const bucket = tiers.get(tier);
		if (bucket) bucket.push(item);
		else tiers.set(tier, [item]);
	}
	const orderedTiers = [...tiers.entries()].sort(([a], [b]) => {
		if (a === null) return 1;
		if (b === null) return -1;
		return b - a;
	});

	return (
		<div className={styles.tiers}>
			{orderedTiers.map(([tier, items]) => (
				<details
					className={styles.tier}
					key={tier ?? "unrated"}
					open
				>
					<summary className={styles.tier_header}>
						{tierLabel(tier)}
						<span className={styles.tier_count}>{items.length}</span>
					</summary>
					<LazyTierGrid items={items} />
				</details>
			))}
		</div>
	);
}
