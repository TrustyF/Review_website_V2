"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

// Wait after the last keystroke before querying, so the input stays responsive.
const DEBOUNCE_MS = 500;

// Avoids React's "useLayoutEffect does nothing on the server" warning.
const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Narrower than this, and result rows (poster + title + meta) get cramped.
const DROPDOWN_MIN_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

type DropdownPosition = { top: number; left: number; width: number };

// Media-agnostic search reachable from every page via the navbar. Collapsed
// to a trigger icon by default; clicking it expands the input inline with
// an animated width, showing live results in a popout below.
export function NavSearch() {
	const [input, setInput] = useState("");
	const [results, setResults] = useState<GlobalSearchResult[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(
		null,
	);

	// Dropdown is portaled apart from the wrapper (see below), so a click
	// inside it must count as "inside" too, same as PosterQuickEditButton.
	useOutsideClick([containerRef, dropdownRef], collapseSearch, {
		enabled: isExpanded,
	});

	// Dropdown is portaled to document.body (see below) so it can render
	// wider than the search bar itself instead of being clamped to it — so
	// its position has to be measured in JS rather than left to CSS.
	useIsomorphicLayoutEffect(() => {
		if (!isExpanded || !isOpen || !overlayRef.current) return;

		function update() {
			const rect = overlayRef.current!.getBoundingClientRect();
			const width = Math.max(rect.width, DROPDOWN_MIN_WIDTH);
			let left = rect.left;
			if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
				left = window.innerWidth - width - VIEWPORT_MARGIN;
			}
			left = Math.max(left, VIEWPORT_MARGIN);
			setDropdownPos({ top: rect.bottom + 8, left, width });
		}

		update();
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);
		return () => {
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [isExpanded, isOpen]);

	// Autofocus on expand, since no click landed on the input itself.
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

	// Collapses back to just the trigger icon.
	function collapseSearch() {
		setInput("");
		setResults([]);
		setIsOpen(false);
		setIsExpanded(false);
	}

	// Portaled to document.body (rather than sitting inside .overlay with
	// position: absolute) so it can render wider than the search bar and
	// isn't clipped by the navbar's own overflow/stacking context.
	const dropdown =
		isExpanded && isOpen && dropdownPos && typeof document !== "undefined"
			? createPortal(
					<div
						ref={dropdownRef}
						className={styles.dropdown}
						style={{
							top: dropdownPos.top,
							left: dropdownPos.left,
							width: dropdownPos.width,
						}}>
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
					</div>,
					document.body,
				)
			: null;

	return (
		<div className={styles.wrapper} ref={containerRef}>
			{/* Always mounted so .expanded animates width instead of mount/unmount;
			tabIndex/aria-hidden keep the width:0 input out of tab order while collapsed. */}
			<div
				ref={overlayRef}
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
			</div>
			<Clickable
				className={styles.trigger}
				aria-label="Search"
				aria-pressed={isExpanded}
				onClick={() => setIsExpanded((expanded) => !expanded)}>
				<Search size={18} />
			</Clickable>
			{dropdown}
		</div>
	);
}
