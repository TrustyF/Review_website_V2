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
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { MediaFilterPopover } from "@/components/media/media-grids/media-filter/media-filter-popover";
import { isFilterActive } from "@/components/media/media-grids/media-filter/media-filter";
import { RankedListRow } from "./ranked-list-row";
import styles from "./ranked-list.module.sass";

type Props = {
	listId: number;
	media: MediaRecord[];
};

// Single-column, top-to-bottom ranked list (drag to reorder) — a wrapping
// grid has no unambiguous "drop it between these two" target once items
// wrap across columns, so ranking only works as a single column. Reordering
// only makes sense against the *complete* list, so it's disabled — via
// useSortable's own `disabled` option on each row (see ranked-list-row.tsx),
// not by unmounting the DnD context — whenever a filter is narrowing what's
// currently visible, or the viewer isn't an admin.
export function RankedList({ listId, media }: Props) {
	const isAdmin = useIsAdmin();
	const { removingId, handleRemove } = useListItemRemoval(listId);
	const [reorderError, setReorderError] = useState<string | null>(null);
	const { filter, setFilter, filteredMedia } = useMediaFilter(media);

	// Local order, so a drag reflects immediately rather than waiting on the
	// server round trip — resynced whenever the server's own order changes
	// underneath it (a fresh load, a successful reorder's revalidatePath, or
	// the filter narrowing/widening what's shown). Compared directly in the
	// render body against the last-seen filteredMedia, not in an effect —
	// same "storing info from previous renders" pattern already used by
	// banner-edit-trigger.tsx's loadedSrc, avoiding an extra effect-triggered
	// re-render for what's really just a prop-change response.
	const [orderedMedia, setOrderedMedia] = useState(filteredMedia);
	const [syncedFilteredMedia, setSyncedFilteredMedia] = useState(filteredMedia);
	if (filteredMedia !== syncedFilteredMedia) {
		setSyncedFilteredMedia(filteredMedia);
		setOrderedMedia(filteredMedia);
	}

	// Reordering (drag or the sort-by-rating button below) only makes sense
	// against the *complete* list — a filtered subset's positions don't map
	// cleanly back onto the full list's.
	const reorderDisabled = !isAdmin || isFilterActive(filter);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	// Shared by drag-end and sort-by-rating — optimistically applies a new
	// order, persists it, and rolls back with an error message if the save
	// fails.
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

	// Same rating sort RatedTierGrid uses (highest first, unrated last) —
	// consistent with what "sorted by rating" already means elsewhere in
	// this app. Confirmed first since it overwrites whatever manual order
	// was there, the same way EditListForm's handleDelete confirms before
	// its own irreversible action.
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
		<div>
			<div className={styles.controls}>
				<MediaFilterPopover media={media} filter={filter} onChange={setFilter} />
				{isAdmin && (
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
				)}
			</div>
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
