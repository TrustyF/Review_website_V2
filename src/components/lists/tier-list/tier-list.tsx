"use client";
import { ReactNode, useMemo, useState } from "react";
import {
	closestCenter,
	CollisionDetection,
	DndContext,
	DragEndEvent,
	DragOverEvent,
	PointerSensor,
	pointerWithin,
	UniqueIdentifier,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
} from "@dnd-kit/sortable";
import type { ListTier } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";
import { setListTiers } from "@/components/lists/list-actions";
import { useListItemRemoval } from "@/components/lists/use-list-item-removal";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useMediaFilter } from "@/components/media/media-grids/media-filter/use-media-filter";
import { isFilterActive } from "@/components/media/media-grids/media-filter/media-filter";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { TierListItem } from "./tier-list-item";
import styles from "./tier-list.module.sass";

const TIERS = ["S", "A", "B", "C", "D"] as const satisfies ListTier[];
const POOL = "POOL";
type RowKey = ListTier | typeof POOL;
const ROW_KEYS: RowKey[] = [...TIERS, POOL];
type Rows = Record<RowKey, number[]>;

type Props = {
	listId: number;
	// In rank order.
	media: MediaRecord[];
	// Null = unplaced pool.
	tiers: Map<number, ListTier | null>;
	// Read-only "already seen" badge, keyed by media id — see list-detail-page.tsx.
	seenMediaIds?: Set<number> | undefined;
};

function buildRows(
	media: MediaRecord[],
	tiers: Map<number, ListTier | null>,
): Rows {
	const rows: Rows = { S: [], A: [], B: [], C: [], D: [], POOL: [] };
	for (const item of media) rows[tiers.get(item.id) ?? POOL].push(item.id);
	return rows;
}

function rowOf(rows: Rows, id: UniqueIdentifier): RowKey | undefined {
	if (ROW_KEYS.includes(id as RowKey)) return id as RowKey;
	return ROW_KEYS.find((key) => rows[key].includes(id as number));
}

// Lettered S–D rows plus an unplaced pool; admins drag posters between and within rows. Dragging is disabled while a filter is active or for non-admins.
export function TierList({ listId, media, tiers, seenMediaIds }: Props) {
	const dict = useDictionary();
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const { removingId, handleRemove } = useListItemRemoval(listId);
	const [saveError, setSaveError] = useState<string | null>(null);
	const { filter, filteredMedia } = useMediaFilter(media);

	// Local rows for immediate drag feedback, resynced when server data changes underneath. Compared in the render body (not an effect) to avoid an extra re-render.
	const [rows, setRows] = useState(() => buildRows(media, tiers));
	const [synced, setSynced] = useState({ media, tiers });
	if (media !== synced.media || tiers !== synced.tiers) {
		setSynced({ media, tiers });
		setRows(buildRows(media, tiers));
	}
	// Rows as they were before the current drag, for rollback.
	const [dragStartRows, setDragStartRows] = useState<Rows | null>(null);

	const mediaById = useMemo(
		() => new Map(media.map((m) => [m.id, m])),
		[media],
	);
	const visibleIds = useMemo(
		() => new Set(filteredMedia.map((m) => m.id)),
		[filteredMedia],
	);

	// Moving items only makes sense against the complete list, not a filtered subset.
	const dragDisabled = !isAdmin || isFilterActive(filter);

	// Row under the pointer wins, then the nearest item within it — corner/rect distance alone lets a nearby poster in another row beat a wide empty row.
	const collisionDetection: CollisionDetection = (args) => {
		const rowHit = pointerWithin(args).find((hit) =>
			ROW_KEYS.includes(hit.id as RowKey),
		);
		if (!rowHit) return [];
		const rowIds = rows[rowHit.id as RowKey];
		const items = args.droppableContainers.filter((c) =>
			rowIds.includes(c.id as number),
		);
		if (items.length === 0) return [rowHit];
		return closestCenter({ ...args, droppableContainers: items });
	};

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	// Optimistic update, rolled back on failure.
	async function persist(next: Rows, previous: Rows) {
		setRows(next);
		setSaveError(null);
		try {
			await setListTiers(
				listId,
				ROW_KEYS.map((key) => ({
					tier: key === POOL ? null : key,
					mediaIds: next[key],
				})),
			);
		} catch {
			setRows(previous);
			setSaveError("Failed to save the new order. Try again.");
		}
	}

	// Cross-row moves happen live during the drag so the target row opens a gap.
	function handleDragOver({ active, over }: DragOverEvent) {
		if (!over) return;
		const from = rowOf(rows, active.id);
		const to = rowOf(rows, over.id);
		if (!from || !to || from === to) return;

		const overIndex = rows[to].indexOf(over.id as number);
		const insertAt = overIndex === -1 ? rows[to].length : overIndex;
		setRows({
			...rows,
			[from]: rows[from].filter((id) => id !== active.id),
			[to]: [
				...rows[to].slice(0, insertAt),
				active.id as number,
				...rows[to].slice(insertAt),
			],
		});
	}

	async function handleDragEnd({ active, over }: DragEndEvent) {
		const previous = dragStartRows ?? rows;
		setDragStartRows(null);
		const row = rowOf(rows, active.id);
		if (!over || !row) {
			setRows(previous);
			return;
		}

		let next = rows;
		const oldIndex = rows[row].indexOf(active.id as number);
		const newIndex = rows[row].indexOf(over.id as number);
		if (newIndex !== -1 && oldIndex !== newIndex) {
			next = { ...rows, [row]: arrayMove(rows[row], oldIndex, newIndex) };
		}
		if (ROW_KEYS.every((key) => next[key].join() === previous[key].join())) {
			return;
		}
		await persist(next, previous);
	}

	// Same rating sort RatedTierGrid uses (highest first, unrated last), applied within each row. Confirmed first since it overwrites the manual order.
	function handleSortByRating() {
		if (
			!confirm(
				"Sort each tier by rating? This will override the current order within tiers.",
			)
		) {
			return;
		}
		const rating = (id: number) => mediaById.get(id)?.review?.rating ?? -1;
		const sorted = Object.fromEntries(
			ROW_KEYS.map((key) => [
				key,
				[...rows[key]].sort((a, b) => rating(b) - rating(a)),
			]),
		) as Rows;
		persist(sorted, rows);
	}

	const showPool = isAdmin || rows.POOL.some((id) => visibleIds.has(id));

	return (
		<div className={styles.wrapper}>
			{isAdmin && (
				<div className={styles.controls}>
					<button
						type="button"
						className={styles.sort_button}
						disabled={dragDisabled}
						title={
							isFilterActive(filter)
								? "Clear the filter to sort the full list"
								: undefined
						}
						onClick={handleSortByRating}>
						Sort tiers by rating
					</button>
					{saveError && <div className={styles.error}>{saveError}</div>}
				</div>
			)}
			{filteredMedia.length === 0 ? (
				<p className={styles.empty}>{dict.media.filter.noMatches}</p>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={collisionDetection}
					onDragStart={() => setDragStartRows(rows)}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
					onDragCancel={() => {
						if (dragStartRows) setRows(dragStartRows);
						setDragStartRows(null);
					}}>
					<div className={styles.tiers}>
						{ROW_KEYS.filter((key) => key !== POOL || showPool).map((key) => (
							<TierRow
								key={key}
								rowKey={key}
								label={key === POOL ? "" : key}
								ids={rows[key].filter((id) => visibleIds.has(id))}>
								{(id) => {
									const item = mediaById.get(id);
									if (!item) return null;
									return (
										<TierListItem
											key={id}
											media={item}
											dragDisabled={dragDisabled}
											canRemove={isAdmin}
											isRemoving={removingId === id}
											onRemove={() => handleRemove(id)}
											seen={seenMediaIds?.has(id) ?? false}
										/>
									);
								}}
							</TierRow>
						))}
					</div>
				</DndContext>
			)}
		</div>
	);
}

type TierRowProps = {
	rowKey: RowKey;
	label: string;
	ids: number[];
	children: (id: number) => ReactNode;
};

// The whole row (label included) is the droppable, so an empty row still accepts drops.
function TierRow({ rowKey, label, ids, children }: TierRowProps) {
	const { setNodeRef } = useDroppable({ id: rowKey });
	return (
		<div ref={setNodeRef} className={styles.tier} data-tier={rowKey}>
			<div className={styles.tier_label}>{label}</div>
			<SortableContext items={ids} strategy={rectSortingStrategy}>
				<div className={styles.tier_items}>{ids.map(children)}</div>
			</SortableContext>
		</div>
	);
}
