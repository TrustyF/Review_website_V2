"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useFeaturedManagerStore } from "./featured-manager-store";
import {
	FeaturedReviewSummary,
	getFeaturedReviews,
	searchUnfeaturedReviews,
	setReviewFeatured,
} from "./featured-manager-actions";
import styles from "./featured-manager-modal.module.sass";

// How long to wait after the last keystroke before querying the server.
const DEBOUNCE_MS = 200;

function ResultRow({
	item,
	actionLabel,
	onAction,
	pending,
}: {
	item: FeaturedReviewSummary;
	actionLabel: string;
	onAction: () => void;
	pending: boolean;
}) {
	return (
		<li className={styles.row}>
			<Image
				src={item.posterSrc}
				alt=""
				width={40}
				height={50}
				className={styles.row_poster}
			/>
			<span className={styles.row_title}>{item.title}</span>
			<button
				type="button"
				className={styles.row_action}
				disabled={pending}
				onClick={onAction}>
				{actionLabel}
			</button>
		</li>
	);
}

// Global admin tool for curating the homepage hero's featured set. Mounted once, unconditionally, in layout.tsx (like MediaEditorModal) so state survives between opens instead of resetting on remount.
export function FeaturedManagerModal() {
	const isOpen = useFeaturedManagerStore((s) => s.isOpen);
	const close = useFeaturedManagerStore((s) => s.close);

	const [featured, setFeatured] = useState<FeaturedReviewSummary[]>([]);
	const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<FeaturedReviewSummary[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	// mediaId currently mid-request — disables just that row's button, not the whole modal.
	const [pendingId, setPendingId] = useState<number | null>(null);

	function refetchFeatured() {
		setIsLoadingFeatured(true);
		getFeaturedReviews()
			.then(setFeatured)
			.finally(() => setIsLoadingFeatured(false));
	}

	// Reloads the featured list fresh on every open, guarding against it going stale elsewhere while closed.
	// setState runs inside setTimeout (imperceptible 0ms) rather than directly in the effect body, same as the debounced search effect below.
	useEffect(() => {
		if (!isOpen) return;
		const timeout = setTimeout(() => {
			setQuery("");
			setResults([]);
			refetchFeatured();
		}, 0);
		return () => clearTimeout(timeout);
	}, [isOpen]);

	useEffect(() => {
		if (!query.trim()) return;
		const timeout = setTimeout(() => {
			setIsSearching(true);
			searchUnfeaturedReviews(query)
				.then(setResults)
				.finally(() => setIsSearching(false));
		}, DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [query]);

	// <body> uses min-height not height, so <html> is the actual scrolling element and both need locking.
	useEffect(() => {
		if (!isOpen) return;
		const html = document.documentElement;
		const previousHtmlOverflow = html.style.overflow;
		const previousBodyOverflow = document.body.style.overflow;
		html.style.overflow = "hidden";
		document.body.style.overflow = "hidden";
		return () => {
			html.style.overflow = previousHtmlOverflow;
			document.body.style.overflow = previousBodyOverflow;
		};
	}, [isOpen]);

	if (!isOpen) return null;

	// Optimistic either direction: flips both lists immediately, then re-syncs from the server once the call settles rather than hand-rolling a rollback.
	function toggle(item: FeaturedReviewSummary, nextFeatured: boolean) {
		setPendingId(item.id);
		if (nextFeatured) {
			setFeatured((prev) => [...prev, item]);
			setResults((prev) => prev.filter((r) => r.id !== item.id));
		} else {
			setFeatured((prev) => prev.filter((f) => f.id !== item.id));
		}
		setReviewFeatured(item.id, nextFeatured)
			.catch(() => {})
			.finally(() => {
				setPendingId(null);
				refetchFeatured();
			});
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.wrapper_body}>
				<h2>Manage featured reviews</h2>

				<div className={styles.section}>
					<h3 className={styles.section_title}>Currently featured</h3>
					{isLoadingFeatured ? (
						<div className={styles.status}>Loading…</div>
					) : featured.length === 0 ? (
						<div className={styles.status}>Nothing featured right now.</div>
					) : (
						<ul className={styles.list}>
							{featured.map((item) => (
								<ResultRow
									key={item.id}
									item={item}
									actionLabel="Remove"
									pending={pendingId === item.id}
									onAction={() => toggle(item, false)}
								/>
							))}
						</ul>
					)}
				</div>

				<span className={styles.divider} />

				<div className={styles.section}>
					<h3 className={styles.section_title}>Feature a review</h3>
					<input
						type="text"
						className={styles.search_input}
						placeholder="Search reviewed titles…"
						value={query}
						onChange={(e) => {
							const value = e.target.value;
							setQuery(value);
							if (!value.trim()) setResults([]);
						}}
					/>
					{query.trim() && (
						<ul className={styles.list}>
							{results.length > 0 ? (
								results.map((item) => (
									<ResultRow
										key={item.id}
										item={item}
										actionLabel="Add"
										pending={pendingId === item.id}
										onAction={() => toggle(item, true)}
									/>
								))
							) : (
								<div className={styles.status}>
									{isSearching ? "Searching…" : "No matches."}
								</div>
							)}
						</ul>
					)}
				</div>

				<button type="button" onClick={close}>
					Close
				</button>
			</div>
		</div>
	);
}
