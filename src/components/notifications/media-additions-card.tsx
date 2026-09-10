"use client";
import { type CSSProperties } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import styles from "./media-additions-card.module.sass";

// Default keeps notifications' time-of-day; activity feed passes its own compact formatter.
function defaultDateFormatter(locale: string) {
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Shared shape between NotificationEntry and ActivityFeedEntry — readAt/onRead are
// notification-only (activity feed has no read state, so `unread` there is always false).
type MediaGroupEntry = {
	id: string | number;
	createdAt: Date;
	readAt?: Date | null;
	media: { id: number; title: string; posterSrc: string } | null;
	groupedLists?: { id: number; title: string; thumbnail: string | null }[];
};

// Inverse of ListAdditionsCard: one media item added to multiple lists same day
export function MediaAdditionsCard<T extends MediaGroupEntry>({
	entry,
	index,
	onRead,
	dateFormatter,
}: {
	entry: T;
	index: number;
	onRead?: (entry: T) => void;
	dateFormatter?: Intl.DateTimeFormat;
}) {
	const dict = useDictionary();
	const locale = useLocale();
	const formatter = dateFormatter ?? defaultDateFormatter(locale);
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
				{...(unread ? { onMouseEnter: () => onRead?.(entry) } : {})}>
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
								{formatter.format(entry.createdAt)}
							</span>
						</div>
						<span className={styles.caption}>
							{dict.notifications.mediaAdditionsCaption(groupedLists.length)}
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
