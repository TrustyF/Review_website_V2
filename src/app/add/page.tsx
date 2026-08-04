"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MediaType } from "@prisma/client";
import {
	addMediaToLibrary,
	searchMediaSources,
} from "@/components/media/media-add/media-add-actions";
import { createManualMedia } from "@/components/media/media-add/manual-add-actions";
import {
	ADDABLE_TYPES,
	AddableType,
	MediaSearchResult,
} from "@/components/media/media-add/addable-types";
import styles from "./add-media.module.sass";

// Covers every real MediaType, not just AddableType — manual entry has no
// provider to have been left out of in the first place, so SHORT (which
// has no dedicated provider search of its own) is creatable here too.
const TYPE_LABELS: Record<MediaType, string> = {
	[MediaType.MOVIE]: "Movie",
	[MediaType.SHORT]: "Short",
	[MediaType.TVSHOW]: "TV Show",
	[MediaType.MANGA]: "Manga",
	[MediaType.COMIC]: "Comic",
	[MediaType.GAME]: "Game",
};

const ALL_MEDIA_TYPES = Object.values(MediaType);

type Mode = "search" | "manual";

const DEBOUNCE_MS = 400;

export default function AddMediaPage() {
	const router = useRouter();

	const [mode, setMode] = useState<Mode>("search");

	const [type, setType] = useState<AddableType>(MediaType.MOVIE);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<MediaSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [addingId, setAddingId] = useState<string | null>(null);
	const [addError, setAddError] = useState<string | null>(null);

	// Manual entry — for media no provider has (or has wrong), created
	// straight from hand-typed fields instead of a provider search result.
	const [manualType, setManualType] = useState<MediaType>(MediaType.MOVIE);
	const [manualTitle, setManualTitle] = useState("");
	const [manualOverview, setManualOverview] = useState("");
	const [manualReleaseDate, setManualReleaseDate] = useState("");
	const [manualPosterUrl, setManualPosterUrl] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

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

	async function handleManualCreate(e: FormEvent) {
		e.preventDefault();
		if (!manualTitle.trim()) return;
		setIsCreating(true);
		setCreateError(null);
		try {
			const mediaId = await createManualMedia({
				type: manualType,
				title: manualTitle,
				overview: manualOverview.trim() || null,
				releaseDate: manualReleaseDate || null,
				posterUrl: manualPosterUrl.trim() || null,
			});
			router.push(`/media/${mediaId}`);
		} catch {
			setCreateError("Failed to create. Try again.");
			setIsCreating(false);
		}
	}

	return (
		<div className={styles.wrapper}>
			<h1>Add media</h1>

			<div className={styles.type_tabs}>
				{ADDABLE_TYPES.map((t) => (
					<button
						key={t}
						className={
							mode === "search" && t === type
								? styles.type_tab_active
								: styles.type_tab
						}
						onClick={() => {
							setMode("search");
							setType(t);
						}}
					>
						{TYPE_LABELS[t]}
					</button>
				))}
				<button
					className={
						mode === "manual" ? styles.type_tab_active : styles.type_tab
					}
					onClick={() => setMode("manual")}
				>
					Manual
				</button>
			</div>

			{mode === "manual" ? (
				<form
					className={styles.manual_form}
					onSubmit={handleManualCreate}
				>
					<label className={styles.manual_field}>
						Type
						<select
							className={styles.manual_select}
							value={manualType}
							onChange={(e) => setManualType(e.target.value as MediaType)}
						>
							{ALL_MEDIA_TYPES.map((t) => (
								<option
									key={t}
									value={t}
								>
									{TYPE_LABELS[t]}
								</option>
							))}
						</select>
					</label>
					<label className={styles.manual_field}>
						Title
						<input
							className={styles.manual_input}
							type="text"
							value={manualTitle}
							onChange={(e) => setManualTitle(e.target.value)}
							required
							autoFocus
						/>
					</label>
					<label className={styles.manual_field}>
						Overview
						<textarea
							className={styles.manual_textarea}
							value={manualOverview}
							onChange={(e) => setManualOverview(e.target.value)}
						/>
					</label>
					<label className={styles.manual_field}>
						Release date
						<input
							className={styles.manual_input}
							type="date"
							value={manualReleaseDate}
							onChange={(e) => setManualReleaseDate(e.target.value)}
						/>
					</label>
					<label className={styles.manual_field}>
						Poster URL
						<input
							className={styles.manual_input}
							type="text"
							placeholder="https://…"
							value={manualPosterUrl}
							onChange={(e) => setManualPosterUrl(e.target.value)}
						/>
					</label>
					{manualPosterUrl.trim() && (
						// Plain <img>, not next/image — see the same note in
						// media-editor-modal.tsx for why (arbitrary pasted host).
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={manualPosterUrl.trim()}
							alt=""
							className={styles.manual_poster_preview}
						/>
					)}
					{createError && <div className={styles.error}>{createError}</div>}
					<button
						type="submit"
						className={styles.add_button}
						disabled={isCreating || !manualTitle.trim()}
					>
						{isCreating ? "Creating…" : "Create"}
					</button>
				</form>
			) : (
				<>
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

					{!isSearching &&
						query.trim() &&
						results.length === 0 &&
						!searchError && (
							<div className={styles.empty}>
								No results for &quot;{query}&quot;.
							</div>
						)}
				</>
			)}
		</div>
	);
}
