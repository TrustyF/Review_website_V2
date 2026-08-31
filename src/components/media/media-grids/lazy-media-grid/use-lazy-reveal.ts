"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isHydrated, useMarkHydrated } from "@/lib/has-hydrated";

// Sized past a typical viewport so the initial batch fills the screen, keeping the first IntersectionObserver check from firing immediately. Callers with differently-sized items can override via batchSize.
const DEFAULT_BATCH_SIZE = 24;

// Reveal-more-on-scroll bookkeeping shared by LazyMediaGrid, LazyMediaList, and ActivityFeed. Generic over id type since only the id is used (for itemsKey below).
export function useLazyReveal<T extends { id: string | number }>(
	items: T[],
	restoreKey?: string,
	batchSize: number = DEFAULT_BATCH_SIZE,
) {
	useMarkHydrated();
	const pathname = usePathname();
	const storageKey = restoreKey ? `lazy-grid:${pathname}:${restoreKey}` : null;

	const [visibleCount, setVisibleCount] = useState(batchSize);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Compared by id set, not array identity — revalidatePath hands a new array on every edit even when rows are unchanged, which used to wrongly reset reveal depth.
	const itemsKey = items.map((item) => item.id).join(",");
	const [prevItemsKey, setPrevItemsKey] = useState(itemsKey);
	if (itemsKey !== prevItemsKey) {
		setPrevItemsKey(itemsKey);
		setVisibleCount(batchSize);
	}

	// Restores prior scroll depth via a render-phase update (not an effect), so the page is already tall before the parent's scroll-restore effect runs. isHydrated() guards against a mismatch on the first hard-load render.
	const [hasRestored, setHasRestored] = useState(false);
	if (!hasRestored && storageKey && isHydrated()) {
		setHasRestored(true);
		const saved = Number(sessionStorage.getItem(storageKey));
		if (saved > batchSize) {
			setVisibleCount(Math.min(saved, items.length));
		}
	}

	useEffect(() => {
		if (storageKey) sessionStorage.setItem(storageKey, String(visibleCount));
	}, [storageKey, visibleCount]);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		// rootMargin gives it a head start: next batch mounts before the sentinel reaches the viewport edge.
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setVisibleCount((count) => Math.min(count + batchSize, items.length));
			},
			{ rootMargin: "100px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [items.length, batchSize]);

	return { visibleCount, sentinelRef };
}
