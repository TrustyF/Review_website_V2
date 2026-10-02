"use client";
import { useState } from "react";
import { Clock, Eye, X } from "lucide-react";
import { MediaType } from "@prisma/client";
import { Clickable } from "@/components/ui/clickable";
import { useWatched } from "@/components/watched/watched-context";
import { useWatchlist } from "@/components/watchlist/watchlist-context";
import { markAsWatchedLabel } from "@/components/media/media-verb-labels";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { useMediaSelection } from "./media-selection-context";
import styles from "./media-selection.module.sass";

type Props = {
	// Currently visible (filtered) ids, for "Select all".
	visibleIds: number[];
	// Picks the verb ("watched"/"read"/"played"); grids are single-type.
	type: MediaType;
};

// Floating bottom bar shown while in select mode; applies an action to every selected card, then exits.
export function MediaSelectionBar({ visibleIds, type }: Props) {
	const dict = useDictionary();
	const selection = useMediaSelection();
	const { markMany } = useWatched();
	const { addMany } = useWatchlist();
	const [isPending, setIsPending] = useState(false);
	const [hasFailed, setHasFailed] = useState(false);

	if (!selection?.isActive) return null;

	const ids = [...selection.selectedIds];
	const allSelected =
		visibleIds.length > 0 &&
		visibleIds.every((id) => selection.selectedIds.has(id));
	const disabled = isPending || ids.length === 0;

	async function apply(action: (ids: number[]) => Promise<void>) {
		setIsPending(true);
		setHasFailed(false);
		try {
			await action(ids);
			selection?.setActive(false);
		} catch {
			setHasFailed(true);
		} finally {
			setIsPending(false);
		}
	}

	return (
		<div className={styles.bar} role="toolbar">
			<div className={styles.bar_info}>
				<span className={styles.count}>
					{dict.media.selection.selected(ids.length)}
				</span>
				<Clickable
					className={styles.text_action}
					onClick={() => selection.setSelected(allSelected ? [] : visibleIds)}>
					{allSelected
						? dict.media.selection.clear
						: dict.media.selection.selectAll}
				</Clickable>
			</div>
			{hasFailed && (
				<span className={styles.error}>{dict.media.selection.failed}</span>
			)}
			<div className={styles.bar_actions}>
				<Clickable
					className={styles.action}
					disabled={disabled}
					onClick={() => apply(markMany)}>
					<Eye size={16} />
					{markAsWatchedLabel(type, dict)}
				</Clickable>
				<Clickable
					className={styles.action}
					disabled={disabled}
					onClick={() => apply(addMany)}>
					<Clock size={16} />
					{dict.media.selection.addToWatchlist}
				</Clickable>
				<Clickable
					className={styles.close}
					title={dict.media.selection.cancel}
					aria-label={dict.media.selection.cancel}
					onClick={() => selection.setActive(false)}>
					<X size={18} />
				</Clickable>
			</div>
		</div>
	);
}
