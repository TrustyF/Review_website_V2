"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaTitle } from "@/components/media/primitives/title";
import { StarIcon } from "@/components/media/icons/star-icon";
import { HeartIcon } from "@/components/media/icons/heart-icon";
import { MediaRecord } from "@/components/media/types";
import { SeenBadge } from "@/components/watched/seen-badge/seen-badge";
import { useMediaSelection } from "@/components/media/media-grids/media-selection/media-selection-context";
import { MediaSelectOverlay } from "@/components/media/media-grids/media-selection/media-select-overlay";
import styles from "./ranked-list.module.sass";

type Props = {
	media: MediaRecord;
	rank: number;
	// Disabled via useSortable's own option (not by skipping the sortable context) so a non-admin/filtered view still renders, just without the handle.
	dragDisabled: boolean;
	canRemove: boolean;
	isRemoving: boolean;
	onRemove: () => void;
	// Read-only "already seen" badge — see list-detail-page.tsx.
	seen: boolean;
};

// Horizontal row, unlike MediaMiniCardShell's vertical layout — a numbered list reads top to bottom, not as tiles.
export function RankedListRow({
	media,
	rank,
	dragDisabled,
	canRemove,
	isRemoving,
	onRemove,
	seen,
}: Props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: media.id, disabled: dragDisabled });
	const selection = useMediaSelection();
	const isSelecting = selection?.isActive ?? false;

	return (
		<div
			ref={setNodeRef}
			className={`${styles.row} ${isDragging ? styles.row_dragging : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}>
			<div className={styles.rank}>{rank}</div>
			{/* Whole-row target in select mode; drag and remove are hidden meanwhile. */}
			{selection && isSelecting && (
				<MediaSelectOverlay
					title={media.title}
					selected={selection.selectedIds.has(media.id)}
					onToggle={() => selection.toggle(media.id)}
				/>
			)}
			{!dragDisabled && !isSelecting && (
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
					ratio={posterRatioFor(media.type)}
					difficulty={media.review?.difficulty}
				/>
				{seen && <SeenBadge type={media.type} className={styles.seen_badge} />}
			</div>
			<div className={styles.info}>
				<MediaTitle
					title={media.title}
					titleFr={media.titleFr}
					className={styles.title}
				/>
				{media.review && (
					<div className={styles.rating}>
						{media.review.rating}
						<StarIcon size={11} />
						{media.review.liked && <HeartIcon size={12} title="Liked" />}
					</div>
				)}
			</div>
			{canRemove && !isSelecting && (
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
