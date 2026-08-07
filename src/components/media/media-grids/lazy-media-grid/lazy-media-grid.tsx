"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { isHydrated, useMarkHydrated } from "@/lib/has-hydrated";
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
	// Stable id for this grid instance (e.g. a rating tier) — when given,
	// how far the user had scrolled into it survives a back-navigation. Left
	// out by search results, which don't persist across navigation anyway.
	restoreKey?: string;
};

// A grid that reveals more cards as the sentinel scrolls into view, instead
// of mounting every item up front. Shared by RatedTierGrid (one instance per
// tier) and MediaSearchGrid (one instance per search) — both hand it a list
// that can run into the hundreds.
export function LazyMediaGrid({ items, restoreKey }: Props) {
	useMarkHydrated();
	const pathname = usePathname();
	const storageKey = restoreKey ? `lazy-grid:${pathname}:${restoreKey}` : null;

	const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Compared by id set rather than array identity — a revalidated server
	// action (every save/edit action calls revalidatePath) hands this a
	// brand-new `items` array even when the underlying rows are unchanged,
	// which used to be misread as "a new search result set" and reset the
	// reveal depth back to one batch on every edit. Reset only on an actual
	// change: real search input, not a resend of the same rows.
	const itemsKey = items.map((item) => item.id).join(",");
	const [prevItemsKey, setPrevItemsKey] = useState(itemsKey);
	if (itemsKey !== prevItemsKey) {
		setPrevItemsKey(itemsKey);
		setVisibleCount(BATCH_SIZE);
	}

	// Restores how far this grid was scrolled into before, so the page comes
	// back the same height it was left at before MediaSearchGrid's own effect
	// tries to restore the window's scroll position — an effect (even a
	// layout one) runs a whole commit later than a render-phase update, and
	// by then the parent's scroll-restore effect has already fired against
	// the still-short page and clamped to the wrong offset. Gated on
	// isHydrated() so the very first render of a hard page load (where
	// there's no client/server mismatch risk *yet* because nothing has
	// hydrated) never disagrees with what the server sent — every mount
	// after that first one, including a grid remounting on a back-navigation,
	// is a plain client render with no server HTML to match, so it's safe.
	const [hasRestored, setHasRestored] = useState(false);
	if (!hasRestored && storageKey && isHydrated()) {
		setHasRestored(true);
		const saved = Number(sessionStorage.getItem(storageKey));
		if (saved > BATCH_SIZE) {
			setVisibleCount(Math.min(saved, items.length));
		}
	}

	useEffect(() => {
		if (storageKey) sessionStorage.setItem(storageKey, String(visibleCount));
	}, [storageKey, visibleCount]);

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
