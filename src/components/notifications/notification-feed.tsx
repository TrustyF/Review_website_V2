"use client";
import { useState } from "react";
import {
	NOTIFICATION_TYPE_ICON,
	getNotificationHref,
	getNotificationRowContent,
} from "@/components/notifications/notification-content";
import {
	markAllNotificationsRead,
	markNotificationsRead,
} from "@/components/notifications/notification-actions";
import type { NotificationEntry } from "@/components/notifications/notification-actions";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import { TimelineList } from "@/components/activity/activity-feed/timeline-list";
import { TimelineRow } from "@/components/activity/activity-feed/timeline-row";
import { ListAdditionsCard } from "@/components/notifications/list-additions-card";
import { Clickable } from "@/components/ui/clickable";
import styles from "./notification-feed.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

// Dialed separately from useLazyReveal's own 24-item default, same reasoning
// as ACTIVITY_BATCH_SIZE — a notification row is a different shape than a grid card.
const NOTIFICATION_BATCH_SIZE = 10;

function NotificationRow({
	entry,
	index,
	onRead,
}: {
	entry: NotificationEntry;
	index: number;
	onRead: (entry: NotificationEntry) => void;
}) {
	const { target, action, value } = getNotificationRowContent(entry);
	// href is null when the linked list has since been deleted (see
	// getNotificationHref) — TimelineRow still renders a clickable (mark-read)
	// span rather than dropping the row, so a notification never just vanishes.
	const href = getNotificationHref(entry);
	const unread = entry.readAt === null;

	return (
		<TimelineRow
			index={index}
			icon={NOTIFICATION_TYPE_ICON[entry.type]}
			posterSrc={entry.media?.posterSrc}
			target={target}
			date={DateFormatter.format(entry.createdAt)}
			action={action}
			value={value}
			href={href}
			{...(unread ? { onClick: () => onRead(entry) } : {})}
			unread={unread}
		/>
	);
}

export function NotificationFeed({
	notifications,
}: {
	notifications: NotificationEntry[];
}) {
	// Optimistic local readAt overlay — markNotificationsRead/markAllRead's own
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

	// Same reveal-more-on-scroll pattern as ActivityFeed — avoids mounting
	// every notification up front.
	const { visibleCount, sentinelRef } = useLazyReveal(
		entries,
		"notifications",
		NOTIFICATION_BATCH_SIZE,
	);
	const visibleEntries = entries.slice(0, visibleCount);

	function markRead(entry: NotificationEntry) {
		const ids = [entry.id, ...(entry.groupedIds ?? [])];
		setReadOverrides((prev) => {
			const next = new Set(prev);
			for (const id of ids) next.add(id);
			return next;
		});
		void markNotificationsRead(ids);
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

	return (
		<>
			{hasUnread && (
				<Clickable className={styles.mark_all} onClick={markAllRead}>
					Mark all as read
				</Clickable>
			)}
			<TimelineList
				entries={visibleEntries}
				renderRow={(entry, index) =>
					entry.groupedMedia && entry.groupedMedia.length > 0 ? (
						<ListAdditionsCard
							key={entry.id}
							entry={entry}
							index={index}
							onRead={markRead}
						/>
					) : (
						<NotificationRow
							key={entry.id}
							entry={entry}
							index={index}
							onRead={markRead}
						/>
					)
				}
			/>
			{visibleCount < entries.length && (
				<div className={styles.sentinel} ref={sentinelRef} />
			)}
		</>
	);
}
