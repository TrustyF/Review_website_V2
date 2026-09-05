"use client";
import { type CSSProperties } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import type { NotificationEntry } from "@/components/notifications/notification-actions";
import styles from "./list-additions-card.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

// Renders LIST_ITEM_ADDED group with header and poster grid; requires groupedMedia.
export function ListAdditionsCard({
	entry,
	index,
	onRead,
}: {
	entry: NotificationEntry;
	index: number;
	onRead: (entry: NotificationEntry) => void;
}) {
	const list = entry.list;
	const groupedMedia = entry.groupedMedia ?? [];
	if (!list) return null;

	const unread = entry.readAt === null;

	return (
		<li
			className={`${styles.card} ${unread ? styles.unread : ""}`}
			style={{ "--stagger-index": index } as CSSProperties}>
			<Link
				href={`/lists/${list.id}`}
				className={styles.card_link}
				{...(unread ? { onClick: () => onRead(entry) } : {})}>
				<div className={styles.header}>
					{list.thumbnail ? (
						// eslint-disable-next-line @next/next/no-img-element -- arbitrary pasted URL, same as list-preview-card.tsx
						<img src={list.thumbnail} alt="" className={styles.thumbnail} />
					) : (
						<div className={styles.thumbnail_placeholder}>
							{list.title.charAt(0)}
						</div>
					)}
					<div className={styles.content}>
						<div className={styles.title_row}>
							<span className={styles.title}>{list.title}</span>
							<span className={styles.date}>
								{DateFormatter.format(entry.createdAt)}
							</span>
						</div>
						<span className={styles.caption}>
							Added {groupedMedia.length} items
						</span>
					</div>
				</div>
				<div className={styles.media_wrap}>
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
					<div className={styles.media_grid}>
						{groupedMedia.map((media) => (
							<Image
								key={media.id}
								className={styles.poster}
								src={media.posterSrc}
								alt=""
								width={93}
								height={140}
							/>
						))}
					</div>
				</div>
			</Link>
			{unread && <span className={styles.unread_dot} aria-hidden="true" />}
		</li>
	);
}
