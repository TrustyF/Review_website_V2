"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaTitle } from "@/components/media/primitives/title";
import { StarIcon } from "@/components/media/icons/star-icon";
import { MediaRecord } from "@/components/media/types";
import styles from "./ranked-list.module.sass";

type Props = {
	media: MediaRecord;
	rank: number;
	// Reordering only makes sense against the complete list (see
	// ranked-list.tsx) — disabled via useSortable's own option rather than
	// this row not being wrapped in a sortable context at all, since a
	// non-admin/filtered view still needs to render, just without the handle.
	dragDisabled: boolean;
	canRemove: boolean;
	isRemoving: boolean;
	onRemove: () => void;
};

// Horizontal row, unlike MediaMiniCardShell's vertical poster-on-top layout
// — a dense numbered list reads top to bottom, not as tiles.
export function RankedListRow({
	media,
	rank,
	dragDisabled,
	canRemove,
	isRemoving,
	onRemove,
}: Props) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: media.id, disabled: dragDisabled });

	return (
		<div
			ref={setNodeRef}
			className={`${styles.row} ${isDragging ? styles.row_dragging : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}>
			<div className={styles.rank}>{rank}</div>
			{!dragDisabled && (
				// Drag listeners live only on this handle, not the whole row —
				// the poster below stays a plain click-through to /media/[id]
				// with no click-vs-drag disambiguation needed.
				<button
					type="button"
					className={styles.drag_handle}
					aria-label={`Reorder ${media.title}`}
					{...attributes}
					{...listeners}>
					⠿
				</button>
			)}
			<div className={styles.poster_slot}>
				<MediaPoster
					src={media.posterSrc}
					title={media.title}
					mediaId={media.id}
					ratio={posterRatioFor(media.type)}
					difficulty={media.review?.difficulty}
				/>
			</div>
			<div className={styles.info}>
				<MediaTitle title={media.title} className={styles.title} />
				{media.review && (
					<div className={styles.rating}>
						{media.review.rating}
						<StarIcon size={11} />
					</div>
				)}
			</div>
			{canRemove && (
				<button
					type="button"
					className={styles.remove_button}
					aria-label={`Remove ${media.title} from list`}
					disabled={isRemoving}
					onClick={onRemove}>
					×
				</button>
			)}
		</div>
	);
}
