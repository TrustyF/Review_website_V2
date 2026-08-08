"use client";
import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { MediaRecord } from "@/components/media/types";
import { RatedTierGrid } from "@/components/media/media-grids/rated-tier-grid/rated-tier-grid";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
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
};

// Rating-tiered grid with a genre/rating/runtime filter popover — what every
// per-type list page and the credit pages render. Used to also carry its own
// text search box (title/director/studio/overview, grouped by which field
// matched); that moved to one media-agnostic search in the navbar instead of
// living separately on every page (see nav-search.tsx), so this component
// now only owns filtering.
export function MediaFilterGrid({ media }: Props) {
	const pathname = usePathname();
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);

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
		<div className={styles.wrapper}>
			<div className={styles.controls}>
				<MediaFilterPopover
					media={media}
					filter={filter}
					onChange={setFilter}
				/>
			</div>
			<RatedTierGrid media={filteredMedia} />
		</div>
	);
}
