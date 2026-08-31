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

type Props = {
	media: MediaRecord[];
	showRating?: boolean | undefined;
	showTitle?: boolean | undefined;
};

// Rating-tiered grid with a genre/rating/runtime filter popover. Text search moved to the navbar (nav-search.tsx); this only owns filtering now.
export function MediaFilterGrid({ media, showRating, showTitle }: Props) {
	const pathname = usePathname();
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);
	const [sort, setSort] = useState<MediaSortOption>("rating");

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
