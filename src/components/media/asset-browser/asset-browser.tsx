"use client";
import { useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import { ImagePicker } from "@/components/media/media-management/media-editor/components/image-picker";
import {
	getAlternativeBanners,
	getAlternativePosters,
} from "@/components/media/media-management/media-editor/media-editor-actions";
import {
	AssetBrowserSearchResult,
	searchMediaLibrary,
} from "./asset-browser-actions";
import styles from "./asset-browser.module.sass";

type Tab = "banner" | "poster";

type Props = {
	// Kept mounted by the caller even while closed (see digest-banner-form.tsx)
	// so search/selection state survives being closed and reopened — this
	// just controls visibility.
	isOpen: boolean;
	// Handed the picked image's previewSrc (a same-origin /api/image-proxy
	// URL) — the caller decides what to do with it (self-host it, stage it,
	// etc.), same contract as pasting a URL into a plain text field.
	onSelect: (url: string) => void;
	onClose: () => void;
};

// Search-then-browse modal: find a title already in the library, then pick
// one of its posters/banners — reuses the same provider-fetched alternates
// (getAlternativePosters/getAlternativeBanners) and grid (ImagePicker) as the
// media editor's own poster/banner pickers, just without a specific media
// already in context.
export function AssetBrowser({ isOpen, onSelect, onClose }: Props) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<AssetBrowserSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [selected, setSelected] = useState<AssetBrowserSearchResult | null>(
		null,
	);
	// Banners are what this browser gets used for most (see the digest
	// banner) — defaults to that tab rather than posters.
	const [tab, setTab] = useState<Tab>("banner");

	async function handleSearch(value: string) {
		setQuery(value);
		const trimmed = value.trim();
		if (!trimmed) {
			setResults([]);
			return;
		}
		setIsSearching(true);
		try {
			setResults(await searchMediaLibrary(trimmed));
		} finally {
			setIsSearching(false);
		}
	}

	return (
		<div className={styles.backdrop} hidden={!isOpen} onClick={onClose}>
			<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					{selected ? (
						<Clickable
							className={styles.back}
							onClick={() => setSelected(null)}>
							← Back to search
						</Clickable>
					) : (
						<span>Browse posters &amp; banners</span>
					)}
					<Clickable
						className={styles.close}
						onClick={onClose}
						aria-label="Close">
						×
					</Clickable>
				</div>

				{!selected && (
					<div className={styles.search_step}>
						<input
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
									onClick={() => setSelected(result)}>
									{/* Already-hosted through our own poster route, so next/image isn't needed for host-allowlisting reasons — plain <img> just to avoid the extra layout-shift config for a small fixed-size thumb. */}
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={result.posterSrc}
										alt=""
										className={styles.result_poster}
									/>
									<span className={styles.result_title}>{result.title}</span>
								</Clickable>
							))}
						</div>
					</div>
				)}

				{selected && (
					<div className={styles.picker_step}>
						<div className={styles.picker_title}>{selected.title}</div>
						<div className={styles.tabs}>
							<Clickable
								className={`${styles.tab} ${tab === "banner" ? styles.tab_active : ""}`}
								onClick={() => setTab("banner")}>
								Banners
							</Clickable>
							<Clickable
								className={`${styles.tab} ${tab === "poster" ? styles.tab_active : ""}`}
								onClick={() => setTab("poster")}>
								Posters
							</Clickable>
						</div>
						{selected.externalId ? (
							<ImagePicker
								key={`${selected.id}-${tab}`}
								draft={selected}
								fetchOptions={
									tab === "poster"
										? getAlternativePosters
										: getAlternativeBanners
								}
								onPick={(image) => onSelect(image.previewSrc)}
								altText={`${selected.title} ${tab}`}
								errorText="Failed to load images. Try again."
								optionAspectRatio={tab === "banner" ? "16/9" : undefined}
							/>
						) : (
							<div className={styles.status}>
								No provider match for this title — nothing to browse.
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
