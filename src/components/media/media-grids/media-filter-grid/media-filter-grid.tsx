"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MediaRecord } from "@/components/media/types";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import { MediaSortPopover } from "@/components/media/media-grids/media-sort/media-sort-popover";
import { MediaSortedGrid } from "@/components/media/media-grids/media-sort/media-sorted-grid";
import { MediaSortOption } from "@/components/media/media-grids/media-sort/media-sort";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import styles from "./media-filter-grid.module.sass";

// Avoids React's "useLayoutEffect does nothing on the server" warning — this
// component still gets server-rendered on a hard load, where there's no
// scroll position to restore anyway.
const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Set the instant the browser fires a back/forward navigation, so the
// restore effect below only fires for an actual "back" — not a fresh Link
// click into this same page, which should start at the top like normal.
// Module-level rather than state: it needs to survive the *next* mount of
// this component, and a plain variable does since the module itself isn't
// torn down by a client-side route change, only components are.
let cameFromPopState = false;
if (typeof window !== "undefined") {
	window.addEventListener("popstate", () => {
		cameFromPopState = true;
	});
}

type Props = {
	media: MediaRecord[];
	showRating?: boolean | undefined;
	showTitle?: boolean | undefined;
};

// Rating-tiered grid with a genre/rating/runtime filter popover — what every
// per-type list page and the credit pages render. Used to also carry its own
// text search box (title/director/studio/overview, grouped by which field
// matched); that moved to one media-agnostic search in the navbar instead of
// living separately on every page (see nav-search.tsx), so this component
// now only owns filtering.
export function MediaFilterGrid({ media, showRating, showTitle }: Props) {
	const pathname = usePathname();
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);
	const [sort, setSort] = useState<MediaSortOption>("rating");

	// A caller's showRating={false} (e.g. MediaTypeListPage) means "the
	// rating tier headers already say this, don't repeat it on every card" —
	// true only for the default rating-tiered view. Sorted by release/watch
	// date instead, there's no tier header carrying that information
	// anymore, so the rating shows on the cards regardless of what the
	// caller passed.
	const effectiveShowRating = sort === "rating" ? showRating : true;

	// Restores window scroll position on a back-navigation into this page.
	// Can't lean on the browser's/Next's own scroll restoration here — every
	// save/edit on the detail page calls revalidatePath, which evicts this
	// route from the Router Cache along with whatever scroll offset Next had
	// recorded for it. This tracks its own, independent of that cache
	// surviving. Runs as a layout effect so the jump (if any) happens before
	// paint rather than as a visible snap afterward.
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

	return (
		<MediaCardDisplayProvider showRating={effectiveShowRating} showTitle={showTitle}>
			<div className={styles.wrapper}>
				<MediaSortPopover sort={sort} onChange={setSort} />
				<MediaFilterPopover
					media={media}
					filter={filter}
					onChange={setFilter}
				/>
				<MediaSortedGrid media={filteredMedia} sort={sort} />
			</div>
		</MediaCardDisplayProvider>
	);
}
