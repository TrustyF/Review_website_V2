"use client";
import { useState } from "react";
import { Link } from "@/components/ui/link";
import {
	NOTIFICATION_TYPE_ICON,
	getNotificationHref,
	getNotificationText,
} from "@/components/notifications/notification-content";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@/components/notifications/notification-actions";
import type { NotificationEntry } from "@/components/notifications/notification-actions";
import { groupByNotificationMonth } from "@/components/notifications/group-by-notification-month";
import { Clickable } from "@/components/ui/clickable";
import styles from "./notification-feed.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

function NotificationRow({
	entry,
	onRead,
}: {
	entry: NotificationEntry;
	onRead: (id: number) => void;
}) {
	const Icon = NOTIFICATION_TYPE_ICON[entry.type];
	const { title, body } = getNotificationText(entry);
	const href = getNotificationHref(entry);
	const unread = entry.readAt === null;

	function handleClick() {
		if (unread) onRead(entry.id);
	}

	const children = (
		<>
			<Icon size={16} className={styles.type_icon} />
			<span className={styles.content}>
				<span className={styles.title_row}>
					<span className={styles.title}>{title}</span>
					<span className={styles.date}>
						{DateFormatter.format(entry.createdAt)}
					</span>
				</span>
				{body && <span className={styles.body}>{body}</span>}
			</span>
			{unread && <span className={styles.unread_dot} aria-hidden="true" />}
		</>
	);

	return (
		<li className={`${styles.entry} ${unread ? styles.unread : ""}`}>
			{/* href is null when the linked list has since been deleted (see
			getNotificationHref) — rendered without a Link wrapper rather than
			dropped from the feed entirely, so a notification never just
			vanishes. */}
			{href ? (
				<Link href={href} className={styles.entry_link} onClick={handleClick}>
					{children}
				</Link>
			) : (
				<span className={styles.entry_link}>{children}</span>
			)}
		</li>
	);
}

export function NotificationFeed({
	notifications,
}: {
	notifications: NotificationEntry[];
}) {
	// Optimistic local readAt overlay — markNotificationRead/markAllRead's own
	// revalidatePath only refreshes this page on its next server render (e.g.
	// a fresh navigation to it), not the props this client component was
	// already mounted with, so without this the unread dot/styling would
	// linger stale until the user left and came back.
	const [readOverrides, setReadOverrides] = useState<Set<number>>(new Set());
	const entries = notifications.map((entry) =>
		readOverrides.has(entry.id) && entry.readAt === null
			? { ...entry, readAt: new Date() }
			: entry,
	);
	const hasUnread = entries.some((entry) => entry.readAt === null);

	function markRead(id: number) {
		setReadOverrides((prev) => new Set(prev).add(id));
		void markNotificationRead(id);
	}

	function markAllRead() {
		setReadOverrides(new Set(notifications.map((entry) => entry.id)));
		void markAllNotificationsRead();
	}

	if (entries.length === 0) {
		return (
			<p className={styles.empty}>
				Nothing yet — you&apos;ll see it here when an admin makes a list for
				you or adds something to one of your lists.
			</p>
		);
	}

	const groups = groupByNotificationMonth(entries);

	return (
		<>
			{hasUnread && (
				<Clickable className={styles.mark_all} onClick={markAllRead}>
					Mark all as read
				</Clickable>
			)}
			<div className={styles.groups}>
				{groups.map((group) => (
					<details key={group.key} open>
						<summary className={styles.group_header}>{group.label}</summary>
						<ul className={styles.list}>
							{group.entries.map((entry) => (
								<NotificationRow
									key={entry.id}
									entry={entry}
									onRead={markRead}
								/>
							))}
						</ul>
					</details>
				))}
			</div>
		</>
	);
}
