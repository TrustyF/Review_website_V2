"use client";
import { useEffect, useRef, useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import { SeenBadge } from "@/components/watched/seen-badge/seen-badge";
import {
	MediaBrowserSearchResult,
	searchMediaBrowser,
} from "./media-browser-actions";
import styles from "./media-browser.module.sass";

type Props = {
	// Kept mounted to preserve state even when closed; only controls visibility.
	isOpen: boolean;
	// Excluded from results (e.g. media already on the list being added to).
	excludeMediaIds?: number[] | undefined;
	// Read-only "already seen" badge, keyed by media id — see SeenBadge.
	seenMediaIds?: Set<number> | undefined;
	// Hands off the full picked media identity; caller decides what to do with it.
	onSelect: (result: MediaBrowserSearchResult) => void;
	onClose: () => void;
};

// Search-and-pick modal for any flow that needs to find a media item and hand it off
// elsewhere — the general-purpose sibling of AssetBrowser, which browses one title's artwork instead of picking the title itself.
export function MediaBrowser({
	isOpen,
	excludeMediaIds,
	seenMediaIds,
	onSelect,
	onClose,
}: Props) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<MediaBrowserSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// The panel stays mounted while closed (see the isOpen doc comment above),
	// so autoFocus only fires once — refocus explicitly whenever it reopens.
	useEffect(() => {
		if (isOpen) searchInputRef.current?.focus();
	}, [isOpen]);

	async function handleSearch(value: string) {
		setQuery(value);
		const trimmed = value.trim();
		if (!trimmed) {
			setResults([]);
			return;
		}
		setIsSearching(true);
		try {
			setResults(await searchMediaBrowser(trimmed, excludeMediaIds));
		} finally {
			setIsSearching(false);
		}
	}

	function handleSelect(result: MediaBrowserSearchResult) {
		onSelect(result);
		setQuery("");
		setResults([]);
	}

	return (
		<div className={styles.backdrop} hidden={!isOpen} onClick={onClose}>
			<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<span>Browse media</span>
					<Clickable
						className={styles.close}
						onClick={onClose}
						aria-label="Close">
						×
					</Clickable>
				</div>

				<input
					ref={searchInputRef}
					className={styles.search_input}
					type="text"
					placeholder="Search a title…"
					value={query}
					onChange={(e) => handleSearch(e.target.value)}
					autoFocus
				/>
				{isSearching && <div className={styles.status}>Searching…</div>}
				{!isSearching && query.trim() && results.length === 0 && (
					<div className={styles.status}>No matches.</div>
				)}
				<div className={styles.results}>
					{results.map((result) => (
						<Clickable
							key={result.id}
							className={styles.result}
							onClick={() => handleSelect(result)}>
							<div className={styles.result_poster_slot}>
								{/* Already-hosted through our own poster route — plain <img>, same reasoning as AssetBrowser's result thumb. */}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={result.posterSrc}
									alt=""
									className={styles.result_poster}
								/>
								{seenMediaIds?.has(result.id) && (
									<SeenBadge
										type={result.type}
										className={styles.result_seen_badge}
									/>
								)}
							</div>
							<span className={styles.result_title}>{result.title}</span>
						</Clickable>
					))}
				</div>
			</div>
		</div>
	);
}
