"use client";
import styles from "./image-picker.module.sass";
import { useEffect, useRef, useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaType } from "@prisma/client";

export type PickableImage = {
	filePath: string;
	thumbSrc: string;
	previewSrc: string;
};

const PAGE_SIZE = 10;

type Props = {
	draft: MediaRecord;
	// The only thing that actually differs between "pick a poster" and "pick
	// a banner" — everything else (grid, pagination, error state) is
	// identical, so this component owns all of that and just delegates
	// sourcing to whichever fetcher (getAlternativePosters /
	// getAlternativeBanners) the caller passes in.
	fetchOptions: (
		externalId: string,
		type: MediaType,
	) => Promise<PickableImage[]>;
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
	// Fetched once up front, then paged through client-side — cheaper than
	// re-fetching every time "load more" is pressed.
	// A manually-added item (see manual-add-actions.ts) has no provider behind
	// it to fetch alternates from — starts as an empty list rather than null
	// (which would otherwise render as still-loading) since ImagePicker
	// remounts fresh per draft (see key={draft.id} on its call sites), so this
	// initializer re-evaluates correctly whenever the item changes.
	const [options, setOptions] = useState<PickableImage[] | null>(() =>
		draft.externalId ? null : [],
	);
	const [error, setError] = useState<string | null>(null);
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
	// Tracks which options have actually finished loading, so each one can
	// fade in from .option's placeholder color instead of popping straight
	// from blank to fully rendered — same idea as MediaPoster's own
	// isLoaded/onLoad (see primitives.module.sass), just per-option here
	// since a whole grid mounts at once rather than a single image.
	const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());
	const optionsRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!draft.externalId) return;
		fetchOptions(draft.externalId, draft.type)
			.then(setOptions)
			.catch(() => {
				setOptions([]);
				setError(errorText);
			});
	}, [draft.externalId, draft.type, fetchOptions, errorText]);

	// Reveals another page as the sentinel scrolls into view — root is
	// .options itself (not the default viewport), since that's what actually
	// scrolls here (max-height + overflow-y, see image-picker.module.sass),
	// not the page. Same pattern as LazyMediaGrid's sentinel, just scoped to
	// this local scroll container instead of the window.
	useEffect(() => {
		const root = optionsRef.current;
		const sentinel = sentinelRef.current;
		if (!root || !sentinel || !options) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setVisibleCount((count) => Math.min(count + PAGE_SIZE, options.length));
			},
			{ root, rootMargin: "100px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [options]);

	return (
		<div className={styles.image_picker}>
			{error && <div className={styles.image_picker_error}>{error}</div>}
			{options && (
				<div className={styles.options} ref={optionsRef}>
					{options.slice(0, visibleCount).map((option) => (
						<img
							key={option.filePath}
							src={option.thumbSrc}
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
					{visibleCount < options.length && (
						<div className={styles.sentinel} ref={sentinelRef} />
					)}
				</div>
			)}
		</div>
	);
}
