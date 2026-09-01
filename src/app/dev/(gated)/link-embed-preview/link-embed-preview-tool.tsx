"use client";
import { useEffect, useRef, useState } from "react";
import {
	EmbedPreview,
	EmbedSearchResult,
	getEmbedPreview,
	searchMediaForEmbedPreview,
} from "./link-embed-preview-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useOutsideClick } from "@/lib/use-outside-click";
import { Clickable } from "@/components/ui/clickable";
import styles from "./link-embed-preview-dev.module.sass";

// Same debounce as image-crop-tool.tsx's own banner search.
const SEARCH_DEBOUNCE_MS = 200;

// Rough mock of Discord's/WhatsApp's link-unfurl cards, fed by getEmbedPreview
// so title/description/image can't drift from what generateMediaMetadata
// actually puts in the real og: tags.
export function LinkEmbedPreviewTool() {
	const isAdmin = useIsAdmin();
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<EmbedSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [preview, setPreview] = useState<EmbedPreview | null>(null);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	// Bumped on refresh to bust the img tag's own cache — imageUrl already
	// carries ?noCache=1 so the server always recomposites, but an unchanged
	// <img src> won't re-fetch on its own.
	const [refreshNonce, setRefreshNonce] = useState(0);
	// Dev-only toggle: preview the no-banner fallback without touching Media.bannerPath.
	const [posterOnly, setPosterOnly] = useState(false);
	const searchRef = useRef<HTMLDivElement>(null);
	useOutsideClick(searchRef, () => setResults([]), { enabled: results.length > 0 });
	// Prevents pick()'s own query update from re-triggering the search effect.
	const skipNextSearchRef = useRef(false);
	// Guarded for SSR — this component still renders once server-side.
	const [origin] = useState(() =>
		typeof window === "undefined" ? "" : window.location.origin,
	);

	useEffect(() => {
		if (skipNextSearchRef.current) {
			skipNextSearchRef.current = false;
			return;
		}
		if (!query.trim()) return;
		const timeout = setTimeout(() => {
			setIsSearching(true);
			searchMediaForEmbedPreview(query)
				.then(setResults)
				.finally(() => setIsSearching(false));
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [query]);

	useEffect(() => {
		if (selectedId == null) return;
		getEmbedPreview(selectedId, posterOnly)
			.then(setPreview)
			.finally(() => setIsLoadingPreview(false));
	}, [selectedId, refreshNonce, posterOnly]);

	if (!isAdmin) {
		return <div className={styles.wrapper}>Admin access required.</div>;
	}

	function pick(result: EmbedSearchResult) {
		skipNextSearchRef.current = true;
		setSelectedId(result.id);
		setQuery(result.title);
		setResults([]);
		setPreview(null);
		setIsLoadingPreview(true);
	}

	const canonicalUrl = preview ? `${origin}${preview.canonicalPath}` : "";
	const imageUrl = preview?.imageUrl
		? `${preview.imageUrl}&r=${refreshNonce}`
		: null;

	return (
		<div className={styles.wrapper}>
			<h1>Link embed preview</h1>
			<p className={styles.hint}>
				Search a title to see exactly what its WhatsApp/Discord link preview
				will show — same title/description/image generateMediaMetadata
				builds for the real page.
			</p>

			<div className={styles.search} ref={searchRef}>
				<input
					type="text"
					className={styles.search_input}
					placeholder="Search a title…"
					value={query}
					onChange={(e) => {
						const value = e.target.value;
						setQuery(value);
						if (!value.trim()) setResults([]);
					}}
				/>
				{isSearching && <div className={styles.hint}>Searching…</div>}
				{results.length > 0 && (
					<div className={styles.results}>
						{results.map((result) => (
							<Clickable
								key={result.id}
								className={styles.result}
								onClick={() => pick(result)}>
								{result.title}
							</Clickable>
						))}
					</div>
				)}
			</div>

			{isLoadingPreview && <p className={styles.hint}>Loading…</p>}

			{preview && (
				<div className={styles.cards}>
					<div className={styles.toolbar}>
						<Clickable
							className={styles.refresh_button}
							onClick={() => {
								setIsLoadingPreview(true);
								setRefreshNonce((n) => n + 1);
							}}>
							Refresh
						</Clickable>
						<label className={styles.poster_only_toggle}>
							<input
								type="checkbox"
								checked={posterOnly}
								onChange={(e) => {
									setIsLoadingPreview(true);
									setPosterOnly(e.target.checked);
								}}
							/>
							Poster only (skip backdrop composite)
						</label>
					</div>

					<div className={styles.card_column}>
						<span className={styles.card_label}>Discord</span>
						<div className={styles.discord_card}>
							{imageUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={imageUrl}
									alt=""
									className={styles.discord_image}
									style={posterOnly ? { objectFit: "contain", aspectRatio: "auto" } : undefined}
								/>
							)}
							<div className={styles.discord_body}>
								<div className={styles.discord_title}>{preview.title}</div>
								{preview.description && (
									<div className={styles.discord_description}>
										{preview.description}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className={styles.card_column}>
						<span className={styles.card_label}>WhatsApp</span>
						<div className={styles.whatsapp_card}>
							{imageUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={imageUrl}
									alt=""
									className={styles.whatsapp_image}
									style={posterOnly ? { objectFit: "contain", aspectRatio: "auto" } : undefined}
								/>
							)}
							<div className={styles.whatsapp_body}>
								<div className={styles.whatsapp_title}>{preview.title}</div>
								{preview.description && (
									<div className={styles.whatsapp_description}>
										{preview.description}
									</div>
								)}
								<div className={styles.whatsapp_url}>{origin.replace(/^https?:\/\//, "")}</div>
							</div>
						</div>
					</div>

					{!preview.imageUrl && (
						<p className={styles.hint}>
							No poster set on this title — production would show this same
							image-less card.
						</p>
					)}

					<p className={styles.hint}>
						Real card: paste{" "}
						<code>{canonicalUrl}</code> into either app. Layout/cropping/
						truncation past this point is each client&apos;s own renderer —
						not something a meta tag controls.
					</p>
				</div>
			)}
		</div>
	);
}
