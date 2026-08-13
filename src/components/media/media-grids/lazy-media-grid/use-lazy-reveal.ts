"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MediaRecord } from "@/components/media/types";
import { isHydrated, useMarkHydrated } from "@/lib/has-hydrated";

// Sized generously (well past a typical viewport's worth of ~110px cards)
// so the sentinel starts below the fold on ordinary screens — the initial
// batch filling the viewport on its own is what keeps the very first
// IntersectionObserver check from immediately firing a reveal (see below).
// Still far fewer than mounting an entire result set's worth of cards (and
// their client-side poster components) up front, which is what actually
// made hydrating a big page like /movies slow.
const BATCH_SIZE = 24;

// Reveal-more-on-scroll bookkeeping shared by LazyMediaGrid (mini cards, a
// grid) and LazyMediaList (full cards, a vertical list) — both hand this a
// list that can run into the hundreds and just need to know how many of
// them to actually mount right now, plus a sentinel to grow that count.
export function useLazyReveal(items: MediaRecord[], restoreKey?: string) {
	useMarkHydrated();
	const pathname = usePathname();
	const storageKey = restoreKey ? `lazy-grid:${pathname}:${restoreKey}` : null;

	const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Compared by id set rather than array identity — a revalidated server
	// action (every save/edit action calls revalidatePath) hands this a
	// brand-new `items` array even when the underlying rows are unchanged,
	// which used to be misread as "the filtered set changed" and reset the
	// reveal depth back to one batch on every edit. Reset only on an actual
	// change to which media is shown, not a resend of the same rows.
	const itemsKey = items.map((item) => item.id).join(",");
	const [prevItemsKey, setPrevItemsKey] = useState(itemsKey);
	if (itemsKey !== prevItemsKey) {
		setPrevItemsKey(itemsKey);
		setVisibleCount(BATCH_SIZE);
	}

	// Restores how far this list was scrolled into before, so the page comes
	// back the same height it was left at before MediaFilterGrid's own effect
	// tries to restore the window's scroll position — an effect (even a
	// layout one) runs a whole commit later than a render-phase update, and
	// by then the parent's scroll-restore effect has already fired against
	// the still-short page and clamped to the wrong offset. Gated on
	// isHydrated() so the very first render of a hard page load (where
	// there's no client/server mismatch risk *yet* because nothing has
	// hydrated) never disagrees with what the server sent — every mount
	// after that first one, including a remount on a back-navigation, is a
	// plain client render with no server HTML to match, so it's safe.
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

	return { visibleCount, sentinelRef };
}
