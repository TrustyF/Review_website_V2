"use client";
import { useRef, useState } from "react";
import {
	addMediaToList,
	getListPickerData,
	ListPickerData,
	ListPickerOption,
	removeMediaFromList,
} from "@/components/lists/list-actions";
import { UserPicker } from "@/components/lists/list-form/user-picker";
import { Plus } from "lucide-react";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useOutsideClick } from "@/lib/use-outside-click";
import { fuzzySearch } from "@/lib/fuzzy-search";
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

type Tab = "public" | "users";

const LIST_FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

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
	const [data, setData] = useState<ListPickerData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [tab, setTab] = useState<Tab>("public");
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	useOutsideClick(containerRef, () => setIsOpen(false), { enabled: isOpen });

	// Refetched on every open so lists created elsewhere show up; tab/user defaults only on first load.
	async function open() {
		setIsOpen(true);
		setIsLoading(true);
		try {
			const fresh = await getListPickerData(mediaId);
			const members = fresh.lists.filter((l) => l.isMember);
			setMemberIds(new Set(members.map((l) => l.id)));
			if (!data) {
				const firstUserMember = members.find((l) => l.targetUserId);
				const onlyInUserLists =
					members.length > 0 && members.every((l) => l.targetUserId);
				setTab(onlyInUserLists ? "users" : "public");
				setSelectedUserId(firstUserMember?.targetUserId ?? null);
			}
			setData(fresh);
		} finally {
			setIsLoading(false);
		}
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

	const lists = data?.lists ?? [];
	const users = data?.users ?? [];
	const memberOf = lists.filter((l) => memberIds.has(l.id));
	const publicCount = memberOf.filter((l) => !l.targetUserId).length;
	const userCount = memberOf.length - publicCount;
	const badgeIds = new Set(
		memberOf.flatMap((l) => (l.targetUserId ? [l.targetUserId] : [])),
	);
	const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

	const bucket: ListPickerOption[] =
		tab === "public"
			? lists.filter((l) => !l.targetUserId)
			: selectedUser
				? lists.filter((l) => l.targetUserId === selectedUser.id)
				: [];
	const trimmedQuery = query.trim();
	// Ordered by load-time membership, not live, so rows don't jump while toggling.
	const rows = trimmedQuery
		? fuzzySearch(bucket, LIST_FUSE_OPTIONS, trimmedQuery, bucket.length)
		: [...bucket].sort((a, b) => Number(b.isMember) - Number(a.isMember));

	const showRows = tab === "public" || selectedUser;

	return (
		<div className={className} ref={containerRef}>
			<Clickable
				className={`${styles.trigger} ${memberIds.size > 0 ? styles.trigger_active : ""}`}
				title="Add to list"
				aria-label="Add to list"
				onClick={() => (isOpen ? setIsOpen(false) : open())}>
				<Plus size={14} />
			</Clickable>
			{isOpen && (
				<div className={styles.popover}>
					<div className={styles.tabs}>
						<Clickable
							className={`${styles.tab} ${tab === "public" ? styles.tab_active : ""}`}
							aria-pressed={tab === "public"}
							onClick={() => setTab("public")}>
							Public{publicCount > 0 && ` (${publicCount})`}
						</Clickable>
						<Clickable
							className={`${styles.tab} ${tab === "users" ? styles.tab_active : ""}`}
							aria-pressed={tab === "users"}
							onClick={() => setTab("users")}>
							User lists{userCount > 0 && ` (${userCount})`}
						</Clickable>
					</div>

					{!data && isLoading && <div className={styles.status}>Loading…</div>}

					{data && tab === "users" && (
						<div className={styles.users}>
							<UserPicker
								options={users}
								value={selectedUserId}
								onChange={setSelectedUserId}
								hidePublicOption
								badgeIds={badgeIds}
								compact
							/>
						</div>
					)}

					{data && showRows && (
						<>
							<input
								className={styles.search_input}
								type="text"
								placeholder="Filter lists…"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								autoFocus
							/>
							{rows.length === 0 && (
								<div className={styles.status}>
									{trimmedQuery ? "No matches." : "No lists yet."}
								</div>
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
						</>
					)}

					{data && tab === "users" && !selectedUser && (
						<div className={styles.status}>Pick a user.</div>
					)}
				</div>
			)}
		</div>
	);
}
