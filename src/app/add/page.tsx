"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MediaType } from "@prisma/client";
import { addMediaToLibrary, searchMediaSources } from "@/components/media/media-add/media-add-actions";
import { ADDABLE_TYPES, AddableType, MediaSearchResult } from "@/components/media/media-add/addable-types";
import styles from "./add-media.module.sass";

const TYPE_LABELS: Record<AddableType, string> = {
	[MediaType.MOVIE]: "Movie",
	[MediaType.TVSHOW]: "TV Show",
	[MediaType.MANGA]: "Manga",
	[MediaType.GAME]: "Game",
};

const DEBOUNCE_MS = 400;

export default function AddMediaPage() {
	const router = useRouter();

	const [type, setType] = useState<AddableType>(MediaType.MOVIE);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<MediaSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [addingId, setAddingId] = useState<string | null>(null);
	const [addError, setAddError] = useState<string | null>(null);

	// Debounced: search fires DEBOUNCE_MS after typing stops, not on every
	// keystroke. Re-runs whenever the type tab changes too, so switching
	// tabs re-searches the current query against the new source. Nothing
	// here calls setState synchronously in the effect body itself — the
	// empty-query case is handled in the input's own onChange instead, and
	// everything else only runs inside the timeout callback.
	useEffect(() => {
		if (!query.trim()) return;

		const timeout = setTimeout(() => {
			setIsSearching(true);
			setSearchError(null);
			searchMediaSources(type, query)
				.then(setResults)
				.catch(() => setSearchError("Search failed. Try again."))
				.finally(() => setIsSearching(false));
		}, DEBOUNCE_MS);

		return () => clearTimeout(timeout);
	}, [type, query]);

	function handleQueryChange(value: string) {
		setQuery(value);
		if (!value.trim()) {
			setResults([]);
			setSearchError(null);
		}
	}

	async function handleAdd(result: MediaSearchResult) {
		setAddingId(result.externalId);
		setAddError(null);
		try {
			const mediaId = await addMediaToLibrary(type, result.externalId);
			router.push(`/media/${mediaId}`);
		} catch {
			setAddError(`Failed to add "${result.title}". Try again.`);
			setAddingId(null);
		}
	}

	return (
		<div className={styles.wrapper}>
			<h1>Add media</h1>

			<div className={styles.type_tabs}>
				{ADDABLE_TYPES.map((t) => (
					<button
						key={t}
						className={t === type ? styles.type_tab_active : styles.type_tab}
						onClick={() => setType(t)}
					>
						{TYPE_LABELS[t]}
					</button>
				))}
			</div>

			<input
				className={styles.search_input}
				type="text"
				placeholder={`Search for a ${TYPE_LABELS[type].toLowerCase()}…`}
				value={query}
				onChange={(e) => handleQueryChange(e.target.value)}
				autoFocus
			/>

			{searchError && <div className={styles.error}>{searchError}</div>}
			{addError && <div className={styles.error}>{addError}</div>}

			<div className={styles.results}>
				{results.map((result) => (
					<div
						className={styles.result}
						key={result.externalId}
					>
						<Image
							src={result.posterSrc ?? "/posters/placeholder.jpg"}
							alt={result.title}
							width={200}
							height={300}
							className={styles.result_poster}
						/>
						<div className={styles.result_title}>{result.title}</div>
						{result.year && (
							<div className={styles.result_year}>{result.year}</div>
						)}
						<button
							className={styles.add_button}
							disabled={addingId === result.externalId}
							onClick={() => handleAdd(result)}
						>
							{addingId === result.externalId ? "Adding…" : "Add"}
						</button>
					</div>
				))}
			</div>

			{!isSearching && query.trim() && results.length === 0 && !searchError && (
				<div className={styles.empty}>No results for &quot;{query}&quot;.</div>
			)}
		</div>
	);
}
