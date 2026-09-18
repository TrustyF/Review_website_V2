"use client";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MediaRecord } from "@/components/media/types";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import { MediaSortPopover } from "@/components/media/media-grids/media-sort/media-sort-popover";
import { MediaGridControls } from "@/components/media/media-grids/media-grid-controls/media-grid-controls";
import { MediaSortedGrid } from "@/components/media/media-grids/media-sort/media-sorted-grid";
import { MediaSortOption, SORT_OPTIONS } from "@/components/media/media-grids/media-sort/media-sort";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import {
	applyMediaFilterToSearchParams,
	FILTER_DEBOUNCE_MS,
	mediaFilterFromSearchParams,
	MediaFilterState,
} from "@/components/media/media-grids/media-filter/media-filter";
import styles from "./media-filter-grid.module.sass";

// Avoids React's "useLayoutEffect does nothing on the server" warning; no scroll position to restore on a server render anyway.
const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Module-level (survives remounts) flag so the restore effect below fires only on an actual back/forward nav, not a fresh Link click.
let cameFromPopState = false;
if (typeof window !== "undefined") {
	window.addEventListener("popstate", () => {
		cameFromPopState = true;
	});
}

function parseSort(params: URLSearchParams): MediaSortOption {
	const value = params.get("sort");
	return SORT_OPTIONS.some((option) => option.value === value)
		? (value as MediaSortOption)
		: "rating";
}

type Props = {
	media: MediaRecord[];
	showRating?: boolean | undefined;
	showTitle?: boolean | undefined;
};

// useSearchParams needs its own Suspense boundary (see login-page.tsx for the same pattern).
export function MediaFilterGrid(props: Props) {
	return (
		<Suspense fallback={null}>
			<MediaFilterGridInner {...props} />
		</Suspense>
	);
}

// Rating-tiered grid with a genre/rating/runtime filter popover. Text search moved to the navbar (nav-search.tsx); this only owns filtering now.
// Filter/sort live in the URL (not React state alone) so navigating to a detail page and back restores the exact same view — the browser's own history does the work, no client-side restore logic needed.
function MediaFilterGridInner({ media, showRating, showTitle }: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { filter, setFilter, filteredMedia } = useMediaFilter(media, () =>
		mediaFilterFromSearchParams(searchParams),
	);
	const [sort, setSort] = useState<MediaSortOption>(() => parseSort(searchParams));

	// showRating={false} only makes sense for the rating-tiered view (headers already say it); other sorts show it on cards regardless.
	const effectiveShowRating = sort === "rating" ? showRating : true;

	// Tracks scroll position independently since revalidatePath evicts the Router Cache (and Next's own scroll restore) on every edit. Layout effect so the jump happens before paint.
	useIsomorphicLayoutEffect(() => {
		const key = `list-scroll:${pathname}`;
		if (cameFromPopState) {
			cameFromPopState = false;
			const saved = sessionStorage.getItem(key);
			if (saved) window.scrollTo(0, Number(saved));
		}

		const onScroll = () => sessionStorage.setItem(key, String(window.scrollY));
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [pathname]);

	// history.replaceState (not router.replace) so tweaking a filter never re-fetches the page from the server — Next still picks up the change for usePathname/useSearchParams elsewhere. Debounced for the filter (a dragged slider fires many updates/sec); sort changes are discrete clicks, so those go straight through.
	const writeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => () => clearTimeout(writeTimeout.current), []);

	function writeUrl(nextFilter: MediaFilterState, nextSort: MediaSortOption) {
		const params = new URLSearchParams(window.location.search);
		applyMediaFilterToSearchParams(nextFilter, params);
		if (nextSort === "rating") params.delete("sort");
		else params.set("sort", nextSort);
		const query = params.toString();
		window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
	}

	function handleFilterChange(next: MediaFilterState) {
		setFilter(next);
		clearTimeout(writeTimeout.current);
		writeTimeout.current = setTimeout(() => writeUrl(next, sort), FILTER_DEBOUNCE_MS);
	}

	function handleSortChange(next: MediaSortOption) {
		setSort(next);
		writeUrl(filter, next);
	}

	return (
		<MediaCardDisplayProvider showRating={effectiveShowRating} showTitle={showTitle}>
			<div className={styles.wrapper}>
				<MediaGridControls overlay>
					<MediaSortPopover sort={sort} onChange={handleSortChange} />
					<MediaFilterPopover
						media={media}
						filter={filter}
						onChange={handleFilterChange}
					/>
				</MediaGridControls>
				<MediaSortedGrid media={filteredMedia} sort={sort} />
			</div>
		</MediaCardDisplayProvider>
	);
}
