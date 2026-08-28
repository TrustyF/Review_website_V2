"use client";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/ui/link";
import { Clickable } from "@/components/ui/clickable";
import Image from "next/image";
import { Building2, Search, UserRound } from "lucide-react";
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
const DEBOUNCE_MS = 500;

// Media-agnostic search reachable from every page via the navbar — replaces
// the old per-page search that used to live inside MediaSearchGrid (now
// MediaFilterGrid, filter-only). Collapsed to a trigger icon by default (see
// nav-bar.tsx's own comment on why) — clicking it grows the input inline to
// its left, in the navbar's own row (see nav-search.module.sass's .overlay),
// with an animated width rather than an instant show/hide. Type, see live
// results in a popout below the input, click one to jump straight to its
// detail page.
export function NavSearch() {
	const [input, setInput] = useState("");
	const [results, setResults] = useState<GlobalSearchResult[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useOutsideClick(containerRef, collapseSearch, { enabled: isExpanded });

	// Autofocus the input the moment it expands — there's no other cue (no
	// click landed directly on the input itself, unlike a plain always-
	// visible box) to tell the browser this is where typing should go.
	useEffect(() => {
		if (isExpanded) inputRef.current?.focus();
	}, [isExpanded]);

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

	// Collapses back to just the trigger icon — on an outside click, or after
	// a result Link has already handled navigation.
	function collapseSearch() {
		setInput("");
		setResults([]);
		setIsOpen(false);
		setIsExpanded(false);
	}

	return (
		<div className={styles.wrapper} ref={containerRef}>
			{/* Always mounted (rather than only once expanded) so toggling
			.expanded below animates a real width change instead of an instant
			mount/unmount — tabIndex/aria-hidden keep it out of tab order and
			off-screen readers while collapsed, since overflow: hidden alone
			doesn't stop keyboard focus from reaching a width: 0 input. */}
			<div
				className={`${styles.overlay} ${isExpanded ? styles.expanded : ""}`}>
				<input
					ref={inputRef}
					type="text"
					className={styles.input}
					placeholder="Search…"
					value={input}
					tabIndex={isExpanded ? 0 : -1}
					aria-hidden={!isExpanded}
					onChange={(e) => handleQueryChange(e.target.value)}
					onFocus={(e) => {
						e.target.select();
						if (input.trim()) setIsOpen(true);
					}}
				/>
				{isExpanded && isOpen && (
					<div className={styles.dropdown}>
						{error ? (
							<div className={styles.status}>{error}</div>
						) : results.length > 0 ? (
							results.map((result) => (
								<Link
									href={
										result.kind === "media"
											? `/media/${result.id}`
											: result.kind === "person"
												? `/credits/person/${result.id}`
												: `/credits/company/${result.id}`
									}
									key={`${result.kind}-${result.id}`}
									className={styles.result}
									onClick={collapseSearch}>
									{result.kind === "media" ? (
										<Image
											src={result.posterSrc}
											alt=""
											width={64}
											height={80}
											className={styles.result_poster}
										/>
									) : result.kind === "person" && result.photoSrc ? (
										<Image
											src={result.photoSrc}
											alt=""
											width={64}
											height={80}
											className={styles.result_poster}
										/>
									) : (
										<span className={styles.result_poster_placeholder}>
											{result.kind === "company" ? (
												<Building2 size={24} />
											) : (
												<UserRound size={24} />
											)}
										</span>
									)}
									<div className={styles.result_info}>
										<div className={styles.result_title}>
											{result.kind === "media" ? result.title : result.name}
										</div>
										<div className={styles.result_meta}>
											{result.kind === "media" ? (
												<>
													{TYPE_LABELS[result.type]}
													{result.releaseDate && (
														<>
															{" "}
															- {new Date(result.releaseDate).getFullYear()}
														</>
													)}
												</>
											) : (
												<>
													{result.mainRole} - {result.creditCount}{" "}
													{result.creditCount === 1 ? "credit" : "credits"}
												</>
											)}
										</div>
									</div>
								</Link>
							))
						) : (
							<div className={styles.status}>
								{isSearching ? "Searching…" : "No matches."}
							</div>
						)}
					</div>
				)}
			</div>
			<Clickable
				className={styles.trigger}
				aria-label="Search"
				aria-pressed={isExpanded}
				onClick={() => setIsExpanded((expanded) => !expanded)}>
				<Search size={18} />
			</Clickable>
		</div>
	);
}
