"use client";
import { useRef, useState } from "react";
import { Link } from "@/components/ui/link";
import {
	addMediaToList,
	removeMediaFromList,
	searchLists,
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
	memberLists: ListOption[];
	className?: string | undefined;
};

const SEARCH_DEBOUNCE_MS = 200;

// Toggles list membership optimistically, rolling back on failure rather than waiting on the round trip.
export function AddToListButton({ mediaId, memberLists, className }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const [isOpen, setIsOpen] = useState(false);
	const [memberIds, setMemberIds] = useState(
		() => new Set(memberLists.map((l) => l.id)),
	);
	const [pendingId, setPendingId] = useState<number | null>(null);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ListOption[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useOutsideClick(containerRef, () => setIsOpen(false), { enabled: isOpen });

	// Debounced so idle typing doesn't fire a search action per keystroke.
	function handleSearch(value: string) {
		setQuery(value);
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

		const trimmed = value.trim();
		if (!trimmed) {
			setResults([]);
			setIsSearching(false);
			return;
		}
		setIsSearching(true);
		searchTimerRef.current = setTimeout(async () => {
			try {
				const found = await searchLists(trimmed, mediaId);
				setResults(found);
				setMemberIds((prev) => {
					const toAdd = found.filter((r) => r.isMember && !prev.has(r.id));
					if (toAdd.length === 0) return prev;
					const next = new Set(prev);
					for (const r of toAdd) next.add(r.id);
					return next;
				});
			} finally {
				setIsSearching(false);
			}
		}, SEARCH_DEBOUNCE_MS);
	}

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

	const trimmedQuery = query.trim();
	const rows = trimmedQuery ? results : memberLists;

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
					<input
						className={styles.search_input}
						type="text"
						placeholder="Search lists…"
						value={query}
						onChange={(e) => handleSearch(e.target.value)}
						autoFocus
					/>
					{isSearching && <div className={styles.status}>Searching…</div>}
					{!isSearching && trimmedQuery && rows.length === 0 && (
						<div className={styles.status}>No matches.</div>
					)}
					{!trimmedQuery && memberLists.length === 0 && !isSearching && (
						<Link href="/lists/new" className={styles.empty_link}>
							Create a list
						</Link>
					)}
					<ul className={styles.list}>
						{rows.map((list) => (
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
				</div>
			)}
		</div>
	);
}
