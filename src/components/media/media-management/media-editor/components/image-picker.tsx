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
	// The only thing that actually differs between "pick a poster" and "pick
	// a banner" — everything else (grid, pagination, error state) is
	// identical, so this component owns all of that and just delegates
	// sourcing to whichever fetcher (getAlternativePosters /
	// getAlternativeBanners) the caller passes in. Each call fetches one page
	// — the server does the actual slicing/sorting, so a title's full 60-80+
	// candidate images is never sent (or proxied) all at once.
	fetchOptions: (
		externalId: string,
		type: MediaType,
		offset: number,
		limit: number,
	) => Promise<ImageOptionsPage>;
	onPick: (image: PickableImage) => void;
	altText: string;
	errorText: string;
	// Crops each option thumbnail to this ratio instead of showing it at its
	// raw, native framing — banners pass "16/9" here since that's the ratio
	// they actually get center-cropped to on the detail page (see
	// media-detail.module.sass's .banner), which otherwise looks nothing like
	// the uncropped backdrop shown in the picker. Left unset for posters,
	// which render close enough to their native ratio already. `| undefined`
	// or exactOptionalPropertyTypes rejects EditImagePopover explicitly
	// forwarding undefined through here for its poster callers.
	optionAspectRatio?: string | undefined;
};

// Lets you browse a media's other posters/banners (TMDB, MangaDex, ...) and
// try one against the preview without committing to anything — the actual
// field only changes (and the image only downloads/caches) once the parent
// modal saves. Render this with `key={draft.id}` so switching to a
// different media item while the modal stays open remounts it and
// re-fetches for the new item, instead of showing the previous item's
// options.
export function ImagePicker({
	draft,
	fetchOptions,
	onPick,
	altText,
	errorText,
	optionAspectRatio,
}: Props) {
	// Accumulates one page at a time as the sentinel is scrolled into view —
	// each page is its own fetchOptions call (server does the slicing), so a
	// title's full 60-80+ candidate list is never fetched (or proxied) up
	// front, only as far as the user actually scrolls.
	// A manually-added item (see manual-add-actions.ts) has no provider behind
	// it to fetch alternates from — starts as an empty list rather than null
	// (which would otherwise render as still-loading) since ImagePicker
	// remounts fresh per draft (see key={draft.id} on its call sites), so this
	// initializer re-evaluates correctly whenever the item changes.
	const [options, setOptions] = useState<PickableImage[] | null>(() =>
		draft.externalId ? null : [],
	);
	const [hasMore, setHasMore] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// Tracks which options have actually finished loading, so each one can
	// fade in from .option's placeholder color instead of popping straight
	// from blank to fully rendered — same idea as MediaPoster's own
	// isLoaded/onLoad (see primitives.module.sass), just per-option here
	// since a whole grid mounts at once rather than a single image.
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
		// Only the initial page load on mount/draft change — loadNextPage
		// itself is stable per draft, so it's intentionally left out here to
		// avoid re-fetching page 1 every time it's re-created.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [draft.externalId, draft.type]);

	// Loads another page as the sentinel scrolls into view — root is
	// .options itself (not the default viewport), since that's what actually
	// scrolls here (max-height + overflow-y, see image-picker.module.sass),
	// not the page. Same pattern as LazyMediaGrid's sentinel, just scoped to
	// this local scroll container instead of the window.
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
