"use client";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MediaRecord } from "@/components/media/types";
import { RatedTierGrid } from "@/components/media/media-grids/rated-tier-grid/rated-tier-grid";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./media-search-grid.module.sass";

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

export type MediaSearchEntry = {
	media: MediaRecord;
	// Pre-lowercased at fetch time (see build-search-entries.ts) so typing
	// never re-lowercases a whole list's worth of titles/overviews on every
	// keystroke — matching a debounced query is just a plain .includes().
	searchText: {
		title: string;
		directors: string[];
		studios: string[];
		overview: string;
	};
};

type Props = {
	entries: MediaSearchEntry[];
};

// How long to wait after the last keystroke before actually filtering — the
// input stays instantly responsive (it's just local state), the expensive
// pass over every entry only runs once typing pauses.
const DEBOUNCE_MS = 200;

// Lower rank = more relevant. Each item is placed once, under the single
// best-matching field — a title match always outranks an item that only
// happens to also mention the query in its overview.
const RANK_LABELS = ["Title", "Director", "Studio", "Overview"] as const;

function matchRank(entry: MediaSearchEntry, query: string): number | null {
	const { searchText } = entry;
	if (searchText.title.includes(query)) return 0;
	if (searchText.directors.some((name) => name.includes(query))) return 1;
	if (searchText.studios.some((name) => name.includes(query))) return 2;
	if (searchText.overview.includes(query)) return 3;
	return null;
}

// Drop-in wrapper around RatedTierGrid: with no query it renders the normal
// rating-tiered layout unchanged. Typing a query switches to results grouped
// by which field matched (title, then director, then studio, then
// overview) — rating tiers stop being a meaningful grouping once relevance
// is the point, so each matched field gets its own section instead.
export function MediaSearchGrid({ entries }: Props) {
	const pathname = usePathname();
	const [input, setInput] = useState("");
	const [query, setQuery] = useState("");

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

	useEffect(() => {
		const handle = setTimeout(
			() => setQuery(input.trim().toLowerCase()),
			DEBOUNCE_MS,
		);
		return () => clearTimeout(handle);
	}, [input]);

	const resultGroups = useMemo(() => {
		if (!query) return null;
		const groups: MediaRecord[][] = RANK_LABELS.map(() => []);
		for (const entry of entries) {
			const rank = matchRank(entry, query);
			if (rank !== null) groups[rank]!.push(entry.media);
		}
		return groups;
	}, [entries, query]);

	const hasResults = resultGroups?.some((group) => group.length > 0) ?? false;

	return (
		<div className={styles.wrapper}>
			<input
				type="text"
				className={styles.search_input}
				placeholder="Search title, director, studio, overview…"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onFocus={(e) => e.target.select()}
			/>
			{resultGroups === null ? (
				<RatedTierGrid media={entries.map((entry) => entry.media)} />
			) : !hasResults ? (
				<p className={styles.empty}>No matches.</p>
			) : (
				<div className={styles.result_groups}>
					{resultGroups.map(
						(items, rank) =>
							items.length > 0 && (
								<div
									className={styles.result_group}
									key={RANK_LABELS[rank]}
								>
									<h3 className={styles.group_title}>
										{RANK_LABELS[rank]}
										<span className={styles.group_count}>{items.length}</span>
									</h3>
									<LazyMediaGrid items={items} />
								</div>
							),
					)}
				</div>
			)}
		</div>
	);
}
