"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
	addMediaToList,
	ListMediaSearchResult,
	searchMediaForList,
} from "@/components/lists/list-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./add-media-to-list.module.sass";

type Props = {
	listId: number;
};

// Debounced so the DB query only fires once typing pauses.
const DEBOUNCE_MS = 400;

export function AddMediaToList({ listId }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ListMediaSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [addingId, setAddingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Empty-query clearing is handled in handleQueryChange, not here.
	useEffect(() => {
		if (!query.trim()) return;

		const timeout = setTimeout(() => {
			setIsSearching(true);
			setError(null);
			searchMediaForList(listId, query)
				.then(setResults)
				.catch(() => setError("Search failed. Try again."))
				.finally(() => setIsSearching(false));
		}, DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [listId, query]);

	function handleQueryChange(value: string) {
		setQuery(value);
		if (!value.trim()) {
			setResults([]);
			setError(null);
		}
	}

	async function handleAdd(result: ListMediaSearchResult) {
		setAddingId(result.id);
		try {
			await addMediaToList(listId, result.id);
			setResults((prev) => prev.filter((r) => r.id !== result.id));
		} catch {
			setError(`Failed to add "${result.title}". Try again.`);
		} finally {
			setAddingId(null);
		}
	}

	if (!isAdmin) return null;

	return (
		<div className={styles.wrapper}>
			<input
				type="text"
				className={styles.search_input}
				placeholder="Search your collection to add…"
				value={query}
				onChange={(e) => handleQueryChange(e.target.value)}
				onFocus={(e) => e.target.select()}
			/>
			{error && <div className={styles.error}>{error}</div>}
			{isSearching && <div className={styles.status}>Searching…</div>}
			{results.length > 0 && (
				<div className={styles.results}>
					{results.map((result) => (
						<div className={styles.result} key={result.id}>
							<Image
								src={result.posterSrc}
								alt={result.title}
								// Sized past the grid column's 90px minimum to stay sharp without the full 500px blanket size.
								width={180}
								height={270}
								className={styles.result_poster}
							/>
							<div className={styles.result_title}>{result.title}</div>
							<button
								type="button"
								className={styles.add_button}
								disabled={addingId === result.id}
								onClick={() => handleAdd(result)}>
								{addingId === result.id ? "Adding…" : "Add"}
							</button>
						</div>
					))}
				</div>
			)}
			{!isSearching && query.trim() && results.length === 0 && !error && (
				<div className={styles.status}>No matches.</div>
			)}
		</div>
	);
}
