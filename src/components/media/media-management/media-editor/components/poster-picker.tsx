"use client";
import styles from "./poster-picker.module.sass";
import { useEffect, useState } from "react";
import { getAlternativePosters } from "@/components/media/media-management/media-editor/media-editor-actions";
import { MediaRecord } from "@/components/media/types";

type PosterOption = {
	filePath: string;
	thumbSrc: string;
	previewSrc: string;
};

const PAGE_SIZE = 10;

type Props = {
	draft: MediaRecord;
	onPick: (poster: PosterOption) => void;
};

// Lets you browse a media's other posters (TMDB, MangaDex, ...) and try one
// against the preview without committing to anything — Media.posterPath only
// changes
// (and the poster only downloads/caches) once the parent modal saves.
// Render this with `key={draft.id}` so switching to a different media item
// while the modal stays open remounts it and re-fetches for the new item,
// instead of showing the previous item's posters.
export function PosterPicker({ draft, onPick }: Props) {
	// Fetched once up front, then paged through client-side — cheaper than
	// re-fetching every time "load more" is pressed.
	const [posterOptions, setPosterOptions] = useState<PosterOption[] | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

	useEffect(() => {
		getAlternativePosters(draft.externalId, draft.type)
			.then(setPosterOptions)
			.catch(() => {
				setPosterOptions([]);
				setError("Couldn't load alternative posters. Try again later.");
			});
	}, [draft.externalId, draft.type]);

	return (
		<div className={styles.poster_picker}>
			{error && <div className={styles.poster_picker_error}>{error}</div>}
			{posterOptions && (
				<>
					<div className={styles.extra_posters}>
						{posterOptions.slice(0, visibleCount).map((poster) => (
							<img
								key={poster.filePath}
								src={poster.thumbSrc}
								alt="Alternative poster option"
								className={styles.extra_poster}
								onClick={() => onPick(poster)}
							/>
						))}
					</div>
					{visibleCount < posterOptions.length && (
						<button
							className={styles.extra_poster_button}
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
