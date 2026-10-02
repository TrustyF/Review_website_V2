"use client";
import { useEffect, useState } from "react";
import { Clock, Eye, EyeOff, X } from "lucide-react";
import { MediaType } from "@prisma/client";
import { Clickable } from "@/components/ui/clickable";
import { useWatched } from "@/components/watched/watched-context";
import { useWatchlist } from "@/components/watchlist/watchlist-context";
import {
	markAsWatchedLabel,
	unmarkAsWatchedLabel,
} from "@/components/media/media-verb-labels";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { useMediaSelection } from "./media-selection-context";
import styles from "./media-selection.module.sass";

type Props = {
	// Currently visible (filtered) media, for "Select all" and the verb ("watched"/"read"/"played").
	visibleMedia: { id: number; type: MediaType }[];
};

// How long the post-action confirmation stays up.
const RESULT_MS = 4000;

// Floating bottom bar shown while in select mode; applies an action to every selected card, then exits.
// Each button adds when any selected item isn't done yet, and flips to removing once all of them are.
export function MediaSelectionBar({ visibleMedia }: Props) {
	const dict = useDictionary();
	const selection = useMediaSelection();
	const { isWatched, markMany, unmarkMany } = useWatched();
	const { isInWatchlist, addMany, removeMany } = useWatchlist();
	const [isPending, setIsPending] = useState(false);
	const [hasFailed, setHasFailed] = useState(false);
	const [result, setResult] = useState<string | null>(null);

	useEffect(() => {
		if (!result) return;
		const timeout = setTimeout(() => setResult(null), RESULT_MS);
		return () => clearTimeout(timeout);
	}, [result]);

	if (!selection?.isActive) {
		return result ? (
			<div className={styles.result} role="status">
				{result}
			</div>
		) : null;
	}

	const ids = [...selection.selectedIds];
	const visibleIds = visibleMedia.map((m) => m.id);
	const toMark = ids.filter((id) => !isWatched(id));
	const toAdd = ids.filter((id) => !isInWatchlist(id));
	const unmarking = ids.length > 0 && toMark.length === 0;
	const removing = ids.length > 0 && toAdd.length === 0;

	// Type-specific verb when the selection (or, before picking, the whole grid) is one type; lists can mix.
	const pool = ids.length
		? visibleMedia.filter((m) => selection.selectedIds.has(m.id))
		: visibleMedia;
	const types = new Set(pool.map((m) => m.type));
	const [onlyType] = types;
	const singleType = types.size === 1 ? onlyType : undefined;

	const sel = dict.media.selection;
	const markLabel = unmarking
		? singleType
			? unmarkAsWatchedLabel(singleType, dict)
			: sel.unmarkAsSeen
		: singleType
			? markAsWatchedLabel(singleType, dict)
			: sel.markAsSeen;
	const addLabel = removing ? sel.removeFromWatchlist : sel.addToWatchlist;
	const markCount = unmarking ? ids.length : toMark.length;
	const addCount = removing ? ids.length : toAdd.length;
	const withCount = (label: string, count: number) =>
		count ? `${label} (${count})` : label;

	const allSelected =
		visibleIds.length > 0 &&
		visibleIds.every((id) => selection.selectedIds.has(id));

	async function apply(action: () => Promise<void>, message: string) {
		setIsPending(true);
		setHasFailed(false);
		try {
			await action();
			setResult(message);
			selection?.setActive(false);
		} catch {
			setHasFailed(true);
		} finally {
			setIsPending(false);
		}
	}

	function handleMark() {
		if (unmarking) apply(() => unmarkMany(ids), sel.unmarkedResult(ids.length));
		else
			apply(
				() => markMany(ids),
				sel.markedResult(toMark.length, ids.length - toMark.length),
			);
	}

	function handleWatchlist() {
		if (removing) apply(() => removeMany(ids), sel.removedResult(ids.length));
		else
			apply(
				() => addMany(ids),
				sel.addedResult(toAdd.length, ids.length - toAdd.length),
			);
	}

	return (
		<div className={styles.bar} role="toolbar">
			<div className={styles.bar_info}>
				<span className={styles.count}>{sel.selected(ids.length)}</span>
				<Clickable
					className={styles.text_action}
					onClick={() => selection.setSelected(allSelected ? [] : visibleIds)}>
					{allSelected ? sel.clear : sel.selectAll}
				</Clickable>
			</div>
			{hasFailed && <span className={styles.error}>{sel.failed}</span>}
			<div className={styles.bar_actions}>
				<Clickable
					className={
						unmarking ? `${styles.action} ${styles.action_undo}` : styles.action
					}
					disabled={isPending || !ids.length}
					onClick={handleMark}>
					{unmarking ? <EyeOff size={16} /> : <Eye size={16} />}
					{withCount(markLabel, markCount)}
				</Clickable>
				<Clickable
					className={
						removing ? `${styles.action} ${styles.action_undo}` : styles.action
					}
					disabled={isPending || !ids.length}
					onClick={handleWatchlist}>
					<Clock size={16} />
					{withCount(addLabel, addCount)}
				</Clickable>
				<Clickable
					className={styles.close}
					title={sel.cancel}
					aria-label={sel.cancel}
					onClick={() => selection.setActive(false)}>
					<X size={18} />
				</Clickable>
			</div>
		</div>
	);
}
