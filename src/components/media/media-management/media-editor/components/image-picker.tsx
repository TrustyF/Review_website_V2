"use client";
import styles from "./image-picker.module.sass";
import { useEffect, useState } from "react";
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
	fetchOptions: (externalId: string, type: MediaType) => Promise<PickableImage[]>;
	onPick: (image: PickableImage) => void;
	altText: string;
	errorText: string;
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

	useEffect(() => {
		if (!draft.externalId) return;
		fetchOptions(draft.externalId, draft.type)
			.then(setOptions)
			.catch(() => {
				setOptions([]);
				setError(errorText);
			});
	}, [draft.externalId, draft.type, fetchOptions, errorText]);

	return (
		<div className={styles.image_picker}>
			{error && <div className={styles.image_picker_error}>{error}</div>}
			{options && (
				<>
					<div className={styles.options}>
						{options.slice(0, visibleCount).map((option) => (
							<img
								key={option.filePath}
								src={option.thumbSrc}
								alt={altText}
								className={styles.option}
								onClick={() => onPick(option)}
							/>
						))}
					</div>
					{visibleCount < options.length && (
						<button
							className={styles.load_more}
							onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
						>
							Load more
						</button>
					)}
				</>
			)}
		</div>
	);
}
