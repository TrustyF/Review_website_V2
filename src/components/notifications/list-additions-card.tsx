"use client";
import { type CSSProperties } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import styles from "./list-additions-card.module.sass";

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
type ListGroupEntry = {
	id: string | number;
	createdAt: Date;
	readAt?: Date | null;
	list: { id: number; title: string; titleFr: string | null; thumbnail: string | null } | null;
	groupedMedia?: { id: number; title: string; posterSrc: string }[];
	// The list's own creation folded into this same-day group — see
	// activity-actions.ts/notification-actions.ts's own groupSameDayListAdditions.
	listCreated?: boolean;
};

// Renders LIST_ITEM_ADDED group with header and poster grid; requires groupedMedia.
export function ListAdditionsCard<T extends ListGroupEntry>({
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
	const list = entry.list;
	const groupedMedia = entry.groupedMedia ?? [];
	if (!list) return null;

	const unread = entry.readAt === null;
	// Falls back to English when untranslated, like MediaTitle.
	const title = locale === "fr" ? (list.titleFr ?? list.title) : list.title;

	return (
		<li
			className={`${styles.card} ${unread ? styles.unread : ""}`}
			style={{ "--stagger-index": index } as CSSProperties}>
			<Link
				href={`/lists/${list.id}`}
				className={styles.card_link}
				{...(unread ? { onMouseEnter: () => onRead?.(entry) } : {})}>
				<div className={styles.header}>
					{list.thumbnail ? (
						// eslint-disable-next-line @next/next/no-img-element -- arbitrary pasted URL, same as list-preview-card.tsx
						<img src={list.thumbnail} alt="" className={styles.thumbnail} />
					) : (
						<div className={styles.thumbnail_placeholder}>
							{title.charAt(0)}
						</div>
					)}
					<div className={styles.content}>
						<div className={styles.title_row}>
							<span className={styles.title}>{title}</span>
							<span className={styles.date}>
								{formatter.format(entry.createdAt)}
							</span>
						</div>
						<span className={styles.caption}>
							{dict.notifications.listAdditionsCaption(
								entry.listCreated ?? false,
								groupedMedia.length,
							)}
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
