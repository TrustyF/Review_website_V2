"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
	addMediaToList,
	removeMediaFromList,
} from "@/components/lists/list-actions";
import { useIsAdminStore } from "@/lib/is-admin-store";
import { useOutsideClick } from "@/lib/use-outside-click";
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

// Small popover, admin-gated same as every other detail-page edit affordance
// — toggles this media's membership in any existing list. Local state is
// optimistic: flips immediately on click, calls the server action in the
// background, and rolls back on failure rather than waiting on a round trip
// (and the revalidatePath inside addMediaToList/removeMediaFromList still
// keeps /lists/[id] itself in sync for when the user navigates there).
export function AddToListButton({
	mediaId,
	allLists,
	memberListIds,
	className,
}: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
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
			<button
				type="button"
				className={styles.trigger}
				onClick={() => setIsOpen((v) => !v)}>
				Add to list
			</button>
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
