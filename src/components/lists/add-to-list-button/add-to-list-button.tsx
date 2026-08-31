"use client";
import { useRef, useState } from "react";
import { Link } from "@/components/ui/link";
import {
	addMediaToList,
	removeMediaFromList,
} from "@/components/lists/list-actions";
import { Plus } from "lucide-react";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useOutsideClick } from "@/lib/use-outside-click";
import { Clickable } from "@/components/ui/clickable";
import styles from "./add-to-list-button.module.sass";

type ListOption = {
	id: number;
	title: string;
};

type Props = {
	mediaId: number;
	allLists: ListOption[];
	memberListIds: number[];
	className?: string | undefined;
};

// Toggles list membership optimistically, rolling back on failure rather than waiting on the round trip.
export function AddToListButton({
	mediaId,
	allLists,
	memberListIds,
	className,
}: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const [isOpen, setIsOpen] = useState(false);
	const [memberIds, setMemberIds] = useState(new Set(memberListIds));
	const [pendingId, setPendingId] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useOutsideClick(containerRef, () => setIsOpen(false), { enabled: isOpen });

	async function toggle(listId: number) {
		const wasMember = memberIds.has(listId);
		setPendingId(listId);
		setMemberIds((prev) => {
			const next = new Set(prev);
			if (wasMember) next.delete(listId);
			else next.add(listId);
			return next;
		});
		try {
			if (wasMember) await removeMediaFromList(listId, mediaId);
			else await addMediaToList(listId, mediaId);
		} catch {
			setMemberIds((prev) => {
				const next = new Set(prev);
				if (wasMember) next.add(listId);
				else next.delete(listId);
				return next;
			});
		} finally {
			setPendingId(null);
		}
	}

	if (!isAdmin) return null;

	return (
		<div className={className} ref={containerRef}>
			<Clickable
				className={styles.trigger}
				title="Add to list"
				aria-label="Add to list"
				onClick={() => setIsOpen((v) => !v)}>
				<Plus size={14} />
			</Clickable>
			{isOpen && (
				<div className={styles.popover}>
					{allLists.length === 0 ? (
						<Link href="/lists/new" className={styles.empty_link}>
							Create a list
						</Link>
					) : (
						<ul className={styles.list}>
							{allLists.map((list) => (
								<li key={list.id} className={styles.item}>
									<label className={styles.label}>
										<input
											type="checkbox"
											checked={memberIds.has(list.id)}
											disabled={pendingId === list.id}
											onChange={() => toggle(list.id)}
										/>
										{list.title}
									</label>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
