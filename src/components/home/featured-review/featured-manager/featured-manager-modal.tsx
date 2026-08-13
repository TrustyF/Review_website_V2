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

// How long to wait after the last keystroke before actually querying the
// server — same idea (and value) as nav-search.tsx's own debounce.
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
				// Same reasoning as every other /api/poster consumer outside
				// MediaPoster itself (see nav-search.tsx's own result thumbnail).
				unoptimized
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

// Global admin tool for curating the homepage hero's featured set — see
// featured-review.tsx's own trigger button (a Settings icon, admin-only)
// and app/page.tsx's getFeaturedReviewItems, which gives whatever's
// featured here priority over plain recency. Mounted once, unconditionally,
// in layout.tsx next to MediaEditorModal — same "always mounted, renders
// null while closed" shape, so this component's own state survives between
// opens instead of resetting on remount.
export function FeaturedManagerModal() {
	const isOpen = useFeaturedManagerStore((s) => s.isOpen);
	const close = useFeaturedManagerStore((s) => s.close);

	const [featured, setFeatured] = useState<FeaturedReviewSummary[]>([]);
	const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<FeaturedReviewSummary[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	// mediaId currently mid-request (either list) — disables just that row's
	// own button rather than the whole modal while a toggle is in flight.
	const [pendingId, setPendingId] = useState<number | null>(null);

	function refetchFeatured() {
		setIsLoadingFeatured(true);
		getFeaturedReviews()
			.then(setFeatured)
			.finally(() => setIsLoadingFeatured(false));
	}

	// Reloads the featured list fresh every time the modal opens — cheap,
	// and guards against it having gone stale from an edit made somewhere
	// else (e.g. a previous open in another tab) while this one was closed.
	// Every setState here runs inside the setTimeout callback (a 0ms delay
	// is imperceptible) rather than directly in the effect body — same
	// "setState from a callback, not synchronously in the effect itself"
	// shape as the debounced search effect below, and as nav-search.tsx's
	// own debounce.
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

	// Same lock reasoning as media-editor-modal.tsx's own effect — this
	// app's <body> uses min-height rather than height, so <html> is the
	// actual scrolling element and both need locking.
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

	// Optimistic either direction: flips both lists immediately, calls the
	// server in the background, and re-syncs the featured list from the
	// server once it settles (success or failure) rather than trying to
	// hand-roll a rollback — a full refetch is cheap here (one query,
	// admin-only, opened rarely) and guarantees the list can never drift
	// from the truth the way a hand-maintained rollback could.
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
