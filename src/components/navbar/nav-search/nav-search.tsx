"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MediaType } from "@prisma/client";
import {
	GlobalSearchResult,
	searchAllMedia,
} from "@/components/search/search-actions";
import { useOutsideClick } from "@/lib/use-outside-click";
import styles from "./nav-search.module.sass";

const TYPE_LABELS: Record<MediaType, string> = {
	[MediaType.MOVIE]: "Movie",
	[MediaType.SHORT]: "Short",
	[MediaType.TVSHOW]: "TV Show",
	[MediaType.MANGA]: "Manga",
	[MediaType.COMIC]: "Comic",
	[MediaType.GAME]: "Game",
	[MediaType.BOOK]: "Book",
};

// How long to wait after the last keystroke before actually querying the
// server — the input stays instantly responsive (it's just local state),
// same idea as every other debounced search in this app.
const DEBOUNCE_MS = 200;

// Media-agnostic search reachable from every page via the navbar — replaces
// the old per-page search that used to live inside MediaSearchGrid (now
// MediaFilterGrid, filter-only). Type, see live results in a popout below
// the input, click one to jump straight to its detail page.
export function NavSearch() {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [results, setResults] = useState<GlobalSearchResult[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useOutsideClick(containerRef, () => setIsOpen(false), { enabled: isOpen });

	useEffect(() => {
		if (!input.trim()) return;

		const timeout = setTimeout(() => {
			setIsSearching(true);
			setError(null);
			searchAllMedia(input)
				.then(setResults)
				.catch(() => setError("Search failed. Try again."))
				.finally(() => setIsSearching(false));
		}, DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [input]);

	function handleQueryChange(value: string) {
		setInput(value);
		if (value.trim()) {
			setIsOpen(true);
		} else {
			setResults([]);
			setError(null);
			setIsOpen(false);
		}
	}

	function handleSelect(id: number) {
		setInput("");
		setResults([]);
		setIsOpen(false);
		router.push(`/media/${id}`);
	}

	return (
		<div className={styles.wrapper} ref={containerRef}>
			<input
				type="text"
				className={styles.input}
				placeholder="Search…"
				value={input}
				onChange={(e) => handleQueryChange(e.target.value)}
				onFocus={(e) => {
					e.target.select();
					if (input.trim()) setIsOpen(true);
				}}
			/>
			{isOpen && (
				<div className={styles.dropdown}>
					{error ? (
						<div className={styles.status}>{error}</div>
					) : results.length > 0 ? (
						results.map((result) => (
							<button
								type="button"
								key={result.id}
								className={styles.result}
								onClick={() => handleSelect(result.id)}>
								<Image
									src={result.posterSrc}
									alt=""
									width={64}
									height={80}
									className={styles.result_poster}
									// Same /api/poster cold-cache timeout reasoning as
									// MediaPoster's own unoptimized (see primitives.tsx) —
									// this renders a different fixed size than that
									// component, but goes through the same lazy-resolve
									// route on the same server-side-fixed encoding.
									unoptimized
								/>
								<div className={styles.result_info}>
									<div className={styles.result_title}>{result.title}</div>
									<div className={styles.result_meta}>
										{TYPE_LABELS[result.type]}
										{result.releaseDate && (
											<> - {new Date(result.releaseDate).getFullYear()}</>
										)}
									</div>
								</div>
							</button>
						))
					) : (
						<div className={styles.status}>
							{isSearching ? "Searching…" : "No matches."}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
