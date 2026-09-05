"use client";
import styles from "./image-picker.module.sass";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaType } from "@prisma/client";

export type PickableImage = {
	filePath: string;
	thumbSrc: string;
	previewSrc: string;
};

const PAGE_SIZE = 10;

export type ImageOptionsPage = { images: PickableImage[]; hasMore: boolean };

// Only what this component reads (MediaRecord or bare search result satisfy this).
type ImagePickerSource = {
	id: number;
	type: MediaType;
	externalId: string | null;
};

type Props = {
	draft: ImagePickerSource;
	// Only difference from posters; server fetches one page, never full candidate list
	fetchOptions: (
		externalId: string,
		type: MediaType,
		offset: number,
		limit: number,
	) => Promise<ImageOptionsPage>;
	onPick: (image: PickableImage) => void;
	altText: string;
	errorText: string;
	// Crops thumbnail to this ratio ("16/9" for banners to match detail-page crop, unset for posters). `| undefined` for exactOptionalPropertyTypes.
	optionAspectRatio?: string | undefined;
};

// Browse/preview without committing; key={draft.id} remounts.
export function ImagePicker({
	draft,
	fetchOptions,
	onPick,
	altText,
	errorText,
	optionAspectRatio,
}: Props) {
	// Accumulates as user scrolls; manual items start empty list (not null) since no provider.
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
			{!error && options === null && (
				<div className={styles.image_picker_status}>Loading…</div>
			)}
			{!error && options?.length === 0 && (
				<div className={styles.image_picker_status}>
					No alternates found for this title.
				</div>
			)}
			{options && options.length > 0 && (
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
