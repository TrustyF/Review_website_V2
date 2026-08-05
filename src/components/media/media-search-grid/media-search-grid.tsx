"use client";
import { useEffect, useMemo, useState } from "react";
import { MediaRecord } from "@/components/media/media-card/types";
import { RatedTierGrid } from "@/components/media/rated-tier-grid/rated-tier-grid";
import { LazyMediaGrid } from "@/components/media/lazy-media-grid/lazy-media-grid";
import styles from "./media-search-grid.module.sass";

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
	const [input, setInput] = useState("");
	const [query, setQuery] = useState("");

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
