"use client";
import { MouseEvent, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaRecord } from "@/components/media/types";
import { SeenBadge } from "@/components/watched/seen-badge/seen-badge";
import { useMediaSelection } from "@/components/media/media-grids/media-selection/media-selection-context";
import { MediaSelectOverlay } from "@/components/media/media-grids/media-selection/media-select-overlay";
import { Clickable } from "@/components/ui/clickable";
import styles from "./tier-list.module.sass";

type Props = {
	media: MediaRecord;
	// Disabled via useSortable's own option (not by skipping the sortable context) so a non-admin/filtered view still renders, just not draggable.
	dragDisabled: boolean;
	canRemove: boolean;
	isRemoving: boolean;
	onRemove: () => void;
	// Read-only "already seen" badge — see list-detail-page.tsx.
	seen: boolean;
};

// One poster tile in a tier row; the whole tile is the drag handle, a plain click still opens /media/[id].
export function TierListItem({
	media,
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
	const canDrag = !dragDisabled && !isSelecting;

	// The click that ends a drag lands on the poster link; swallow it. Cleared a task later, after that click has fired.
	const justDraggedRef = useRef(false);
	useEffect(() => {
		if (isDragging) {
			justDraggedRef.current = true;
			return;
		}
		const timeout = setTimeout(() => {
			justDraggedRef.current = false;
		});
		return () => clearTimeout(timeout);
	}, [isDragging]);

	function handleClickCapture(e: MouseEvent) {
		if (!justDraggedRef.current) return;
		e.preventDefault();
		e.stopPropagation();
		justDraggedRef.current = false;
	}

	return (
		<div
			ref={setNodeRef}
			className={`${styles.item} ${canDrag ? styles.item_draggable : ""} ${isDragging ? styles.item_dragging : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			title={media.title}
			onClickCapture={handleClickCapture}
			// Native image/link drag would cancel the pointer drag.
			onDragStart={(e) => e.preventDefault()}
			{...(canDrag ? { ...attributes, ...listeners } : {})}>
			<MediaPoster
				src={media.posterSrc}
				title={media.title}
				mediaId={media.id}
				ratio={posterRatioFor(media.type)}
			/>
			{seen && <SeenBadge type={media.type} className={styles.seen_badge} />}
			{/* Whole-tile target in select mode; drag and remove are off meanwhile. */}
			{selection && isSelecting && (
				<MediaSelectOverlay
					title={media.title}
					selected={selection.selectedIds.has(media.id)}
					onToggle={() => selection.toggle(media.id)}
				/>
			)}
			{canRemove && !isSelecting && (
				<Clickable
					className={styles.remove_button}
					aria-label={`Remove ${media.title} from list`}
					disabled={isRemoving}
					onClick={onRemove}>
					×
				</Clickable>
			)}
		</div>
	);
}
