"use client";
import styles from "./image-picker.module.sass";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaType } from "@prisma/client";

export type PickableImage = {
	filePath: string;
	thumbSrc: string;
	previewSrc: string;
};

const PAGE_SIZE = 10;

export type ImageOptionsPage = { images: PickableImage[]; hasMore: boolean };

type Props = {
	draft: MediaRecord;
	// The only real difference between posters and banners; grid/pagination/error state is
	// identical. Each call fetches one page — the server slices/sorts, so the full candidate
	// list is never sent all at once.
	fetchOptions: (
		externalId: string,
		type: MediaType,
		offset: number,
		limit: number,
	) => Promise<ImageOptionsPage>;
	onPick: (image: PickableImage) => void;
	altText: string;
	errorText: string;
	// Crops the thumbnail to this ratio — banners pass "16/9" to match their actual detail-page
	// crop, since the uncropped backdrop otherwise looks nothing like it. Unset for posters.
	// `| undefined` since exactOptionalPropertyTypes rejects EditImagePopover forwarding undefined.
	optionAspectRatio?: string | undefined;
};

// Lets you browse a media's other posters/banners and preview one without committing — the
// field only actually changes once the parent saves. Render with `key={draft.id}` so switching
// items remounts and re-fetches instead of showing the previous item's options.
export function ImagePicker({
	draft,
	fetchOptions,
	onPick,
	altText,
	errorText,
	optionAspectRatio,
}: Props) {
	// Accumulates one page at a time as the sentinel scrolls into view, so the full candidate
	// list is only fetched as far as the user scrolls.
	// A manually-added item has no provider to fetch alternates from — starts as an empty list
	// rather than null (which would render as still-loading).
	const [options, setOptions] = useState<PickableImage[] | null>(() =>
		draft.externalId ? null : [],
	);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// Tracks which options finished loading, so each fades in from the placeholder color
	// instead of popping straight in, per-option since a whole grid mounts at once.
	const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());
	const optionsRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	// Guards against the observer firing again (sentinel can stay
	// intersecting) while a page fetch is still in flight.
	const loadingRef = useRef(false);

	const loadNextPage = useCallback(
		(currentCount: number) => {
			if (loadingRef.current || !draft.externalId) return;
			loadingRef.current = true;
			fetchOptions(draft.externalId, draft.type, currentCount, PAGE_SIZE)
				.then(({ images, hasMore: more }) => {
					setOptions((prev) => (prev ?? []).concat(images));
					setHasMore(more);
				})
				.catch(() => {
					setOptions((prev) => prev ?? []);
					setHasMore(false);
					setError(errorText);
				})
				.finally(() => {
					loadingRef.current = false;
				});
		},
		[draft.externalId, draft.type, fetchOptions, errorText],
	);

	useEffect(() => {
		if (!draft.externalId) return;
		loadNextPage(0);
		// loadNextPage is stable per draft, intentionally left out to avoid re-fetching page 1.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [draft.externalId, draft.type]);

	// Loads another page as the sentinel scrolls into view — root is .options itself since
	// that's the local scroll container (max-height + overflow-y), not the page.
	useEffect(() => {
		const root = optionsRef.current;
		const sentinel = sentinelRef.current;
		if (!root || !sentinel || !options || !hasMore) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				loadNextPage(options.length);
			},
			{ root, rootMargin: "100px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [options, hasMore, loadNextPage]);

	return (
		<div className={styles.image_picker}>
			{error && <div className={styles.image_picker_error}>{error}</div>}
			{options && (
				<div className={styles.options} ref={optionsRef}>
					{options.map((option) => (
						<img
							key={option.filePath}
							src={option.thumbSrc}
							loading="lazy"
							alt={altText}
							className={
								loadedPaths.has(option.filePath)
									? `${styles.option} ${styles.option_loaded}`
									: styles.option
							}
							style={
								optionAspectRatio
									? { aspectRatio: optionAspectRatio }
									: undefined
							}
							onLoad={() =>
								setLoadedPaths((prev) =>
									prev.has(option.filePath)
										? prev
										: new Set(prev).add(option.filePath),
								)
							}
							onClick={() => onPick(option)}
						/>
					))}
					{hasMore && <div className={styles.sentinel} ref={sentinelRef} />}
				</div>
			)}
		</div>
	);
}
