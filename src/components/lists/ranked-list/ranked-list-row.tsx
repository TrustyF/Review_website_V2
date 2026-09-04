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
	// Disabled via useSortable's own option (not by skipping the sortable context) so a non-admin/filtered view still renders, just without the handle.
	dragDisabled: boolean;
	canRemove: boolean;
	isRemoving: boolean;
	onRemove: () => void;
};

// Horizontal row, unlike MediaMiniCardShell's vertical layout — a numbered list reads top to bottom, not as tiles.
export function RankedListRow({
	media,
	rank,
	dragDisabled,
	canRemove,
	isRemoving,
	onRemove,
}: Props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: media.id, disabled: dragDisabled });

	return (
		<div
			ref={setNodeRef}
			className={`${styles.row} ${isDragging ? styles.row_dragging : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}>
			<div className={styles.rank}>{rank}</div>
			{!dragDisabled && (
				// Listeners live only on this handle so the poster stays a plain click-through to /media/[id].
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
