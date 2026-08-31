"use client";
import { useState } from "react";
import {
	DndContext,
	DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MediaRecord } from "@/components/media/types";
import { reorderListItems } from "@/components/lists/list-actions";
import { useListItemRemoval } from "@/components/lists/use-list-item-removal";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import { isFilterActive } from "@/components/media/media-grids/media-filter/media-filter";
import { RankedListRow } from "./ranked-list-row";
import styles from "./ranked-list.module.sass";

type Props = {
	listId: number;
	media: MediaRecord[];
};

// Single-column, top-to-bottom (drag to reorder) — a wrapping grid has no unambiguous drop target once items wrap across columns. Reordering is disabled via each row's useSortable `disabled` option (not by unmounting DnD) whenever a filter is active or the viewer isn't an admin.
export function RankedList({ listId, media }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const { removingId, handleRemove } = useListItemRemoval(listId);
	const [reorderError, setReorderError] = useState<string | null>(null);
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);

	// Local order for immediate drag feedback, resynced when server order changes underneath it. Compared in the render body (not an effect) to avoid an extra re-render for what's just a prop-change response.
	const [orderedMedia, setOrderedMedia] = useState(filteredMedia);
	const [syncedFilteredMedia, setSyncedFilteredMedia] = useState(filteredMedia);
	if (filteredMedia !== syncedFilteredMedia) {
		setSyncedFilteredMedia(filteredMedia);
		setOrderedMedia(filteredMedia);
	}

	// Reordering only makes sense against the complete list, not a filtered subset.
	const reorderDisabled = !isAdmin || isFilterActive(filter);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	// Shared by drag-end and sort-by-rating: optimistic update, rolled back on failure.
	async function persistOrder(reordered: MediaRecord[]) {
		const previous = orderedMedia;
		setOrderedMedia(reordered);
		setReorderError(null);
		try {
			await reorderListItems(
				listId,
				reordered.map((m) => m.id),
			);
		} catch {
			setOrderedMedia(previous);
			setReorderError("Failed to save the new order. Try again.");
		}
	}

	async function handleDragEnd(e: DragEndEvent) {
		const { active, over } = e;
		if (!over || active.id === over.id) return;

		const oldIndex = orderedMedia.findIndex((m) => m.id === active.id);
		const newIndex = orderedMedia.findIndex((m) => m.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		await persistOrder(arrayMove(orderedMedia, oldIndex, newIndex));
	}

	// Same rating sort RatedTierGrid uses (highest first, unrated last). Confirmed first since it overwrites the manual order.
	function handleSortByRating() {
		if (
			!confirm(
				"Sort this list by rating? This will override the current order.",
			)
		) {
			return;
		}
		const sorted = [...orderedMedia].sort(
			(a, b) => (b.review?.rating ?? -1) - (a.review?.rating ?? -1),
		);
		persistOrder(sorted);
	}

	return (
		<div className={styles.wrapper}>
			<MediaFilterPopover media={media} filter={filter} onChange={setFilter} />
			{isAdmin && (
				<div className={styles.controls}>
					<button
						type="button"
						className={styles.sort_button}
						disabled={reorderDisabled}
						title={
							isFilterActive(filter)
								? "Clear the filter to sort the full list"
								: undefined
						}
						onClick={handleSortByRating}>
						Sort by rating
					</button>
				</div>
			)}
			{reorderError && <div className={styles.error}>{reorderError}</div>}
			{orderedMedia.length === 0 ? (
				<p className={styles.empty}>No media matches the current filter.</p>
			) : (
				<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
					<SortableContext
						items={orderedMedia.map((m) => m.id)}
						strategy={verticalListSortingStrategy}>
						<div className={styles.list}>
							{orderedMedia.map((item, index) => (
								<RankedListRow
									key={item.id}
									media={item}
									rank={index + 1}
									dragDisabled={reorderDisabled}
									canRemove={isAdmin}
									isRemoving={removingId === item.id}
									onRemove={() => handleRemove(item.id)}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</div>
	);
}
