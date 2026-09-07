"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Clickable } from "@/components/ui/clickable";
import {
	DigestReviewSummary,
	getDigestReviews,
	getSuggestedDigestReviews,
	searchDigestCandidates,
	setReviewInDigest,
} from "./digest-reviews-actions";
import styles from "./digest.module.sass";

const DEBOUNCE_MS = 200;

function ResultRow({
	item,
	actionLabel,
	onAction,
	pending,
}: {
	item: DigestReviewSummary;
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
			<Clickable
				className={styles.row_action}
				disabled={pending}
				onClick={onAction}>
				{actionLabel}
			</Clickable>
		</li>
	);
}

// Poster-only tile for the selected grid — title is a hover tooltip, remove is an overlay button.
function PosterTile({
	item,
	onRemove,
	pending,
}: {
	item: DigestReviewSummary;
	onRemove: () => void;
	pending: boolean;
}) {
	return (
		<div className={styles.poster_tile} title={item.title}>
			<Image
				src={item.posterSrc}
				alt={item.title}
				fill
				sizes="80px"
				className={styles.poster_tile_image}
			/>
			<Clickable
				className={styles.poster_remove}
				aria-label={`Remove ${item.title}`}
				disabled={pending}
				onClick={onRemove}>
				×
			</Clickable>
		</div>
	);
}

type Props = {
	// Bumped by the parent to force a refetch, e.g. after "Clear override" resets selections server-side.
	refreshSignal?: number;
};

// Picks which reviews populate the digest email's "latest reviews" section,
// replacing the old auto-pick-from-the-past-week behavior.
export function DigestReviewsPanel({ refreshSignal }: Props) {
	const [selected, setSelected] = useState<DigestReviewSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [suggested, setSuggested] = useState<DigestReviewSummary[]>([]);
	const [isLoadingSuggested, setIsLoadingSuggested] = useState(true);

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<DigestReviewSummary[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const [pendingId, setPendingId] = useState<number | null>(null);
	const [isSuggestedOpen, setIsSuggestedOpen] = useState(false);

	function refetchSelected() {
		setIsLoading(true);
		getDigestReviews()
			.then(setSelected)
			.finally(() => setIsLoading(false));
	}

	function refetchSuggested() {
		setIsLoadingSuggested(true);
		getSuggestedDigestReviews()
			.then(setSuggested)
			.finally(() => setIsLoadingSuggested(false));
	}

	// setState runs inside setTimeout (imperceptible 0ms), not directly in the
	// effect body — same workaround as featured-manager-modal.tsx.
	useEffect(() => {
		const timeout = setTimeout(() => {
			refetchSelected();
			refetchSuggested();
		}, 0);
		return () => clearTimeout(timeout);
	}, [refreshSignal]);

	useEffect(() => {
		if (!query.trim()) return;
		const timeout = setTimeout(() => {
			setIsSearching(true);
			searchDigestCandidates(query)
				.then(setResults)
				.finally(() => setIsSearching(false));
		}, DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [query]);

	// Optimistic either direction: flips lists immediately, re-syncs once the call settles.
	function toggle(item: DigestReviewSummary, next: boolean) {
		setPendingId(item.id);
		if (next) {
			setSelected((prev) => [item, ...prev]);
			setResults((prev) => prev.filter((r) => r.id !== item.id));
			setSuggested((prev) => prev.filter((s) => s.id !== item.id));
		} else {
			setSelected((prev) => prev.filter((s) => s.id !== item.id));
		}
		setReviewInDigest(item.id, next)
			.catch(() => {})
			.finally(() => {
				setPendingId(null);
				refetchSelected();
				refetchSuggested();
			});
	}

	return (
		<div className={styles.reviews_panel}>
			<h2 className={styles.section_heading}>Latest reviews</h2>

			{isLoading ? (
				<div className={styles.send_description}>Loading…</div>
			) : selected.length === 0 ? (
				<div className={styles.send_description}>
					Nothing selected — this section will be empty in the digest.
				</div>
			) : (
				<div className={styles.poster_grid}>
					{selected.map((item) => (
						<PosterTile
							key={item.id}
							item={item}
							pending={pendingId === item.id}
							onRemove={() => toggle(item, false)}
						/>
					))}
				</div>
			)}

			{!isLoadingSuggested && suggested.length > 0 && (
				<>
					<Clickable
						className={styles.subsection_toggle}
						onClick={() => setIsSuggestedOpen((open) => !open)}
						aria-pressed={isSuggestedOpen}>
						<h3 className={styles.subsection_heading}>
							Suggested ({suggested.length})
						</h3>
						<span className={styles.subsection_chevron}>
							{isSuggestedOpen ? "▾" : "▸"}
						</span>
					</Clickable>
					{isSuggestedOpen && (
						<ul className={styles.list}>
							{suggested.map((item) => (
								<ResultRow
									key={item.id}
									item={item}
									actionLabel="Add"
									pending={pendingId === item.id}
									onAction={() => toggle(item, true)}
								/>
							))}
						</ul>
					)}
				</>
			)}

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
						<div className={styles.send_description}>
							{isSearching ? "Searching…" : "No matches."}
						</div>
					)}
				</ul>
			)}
		</div>
	);
}
