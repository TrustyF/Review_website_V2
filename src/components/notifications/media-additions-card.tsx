"use client";
import { type CSSProperties } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import type { NotificationEntry } from "@/components/notifications/notification-actions";
import styles from "./media-additions-card.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

// Inverse of ListAdditionsCard: one media item added to several different
// lists the same day (see groupSameDayMediaAdditions) — the media's own
// poster on the left like a plain row, "Added to N lists" underneath, and a
// grid of every list's thumbnail below. Only ever called with
// entry.groupedLists set.
export function MediaAdditionsCard({
	entry,
	index,
	onRead,
}: {
	entry: NotificationEntry;
	index: number;
	onRead: (entry: NotificationEntry) => void;
}) {
	const media = entry.media;
	const groupedLists = entry.groupedLists ?? [];
	if (!media) return null;

	const unread = entry.readAt === null;

	return (
		<li
			className={`${styles.card} ${unread ? styles.unread : ""}`}
			style={{ "--stagger-index": index } as CSSProperties}>
			<Link
				href={`/media/${media.id}`}
				className={styles.card_link}
				{...(unread ? { onClick: () => onRead(entry) } : {})}>
				<div className={styles.header}>
					<Image
						className={styles.poster}
						src={media.posterSrc}
						alt=""
						width={93}
						height={140}
					/>
					<div className={styles.content}>
						<div className={styles.title_row}>
							<span className={styles.title}>{media.title}</span>
							<span className={styles.date}>
								{DateFormatter.format(entry.createdAt)}
							</span>
						</div>
						<span className={styles.caption}>
							Added to {groupedLists.length} lists
						</span>
					</div>
				</div>
				<div className={styles.list_wrap}>
					<svg
						className={styles.connector}
						aria-hidden="true"
						viewBox="0 0 20 24"
						fill="none">
						<path
							d="M1 0 V18 H20"
							stroke="currentColor"
							strokeWidth={1}
							strokeDasharray="5 2.6"
						/>
					</svg>
					<div className={styles.list_grid}>
						{groupedLists.map((list) =>
							list.thumbnail ? (
								// eslint-disable-next-line @next/next/no-img-element -- arbitrary pasted URL, same as list-preview-card.tsx
								<img
									key={list.id}
									src={list.thumbnail}
									alt=""
									className={styles.list_thumbnail}
								/>
							) : (
								<div key={list.id} className={styles.list_thumbnail_placeholder}>
									{list.title.charAt(0)}
								</div>
							),
						)}
					</div>
				</div>
			</Link>
			{unread && <span className={styles.unread_dot} aria-hidden="true" />}
		</li>
	);
}
