"use client";
import { type CSSProperties, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import styles from "./activity-feed.module.sass";

// Not structural (lucide/custom icons have incompatible sigs);
// all callers pass exactly size/className.
type RowIcon = ComponentType<Record<string, unknown>>;

// Shared row for feeds: href presence switches row between clickable vs. inert.
export function TimelineRow({
	index,
	icon: Icon,
	posterSrc,
	target,
	date,
	action,
	value,
	href,
	onClick,
	unread,
}: {
	index: number;
	icon: RowIcon;
	posterSrc?: string | undefined;
	target: ReactNode;
	date: string;
	action?: ReactNode;
	value?: ReactNode;
	href?: string | null;
	onClick?: (() => void) | undefined;
	unread?: boolean | undefined;
}) {
	const body = (
		<>
			{posterSrc ? (
				<Image
					className={styles.poster}
					src={posterSrc}
					alt=""
					// Matches the cached thumbnail's actual on-disk size; .poster's own
					// sizing governs the rendered size regardless.
					width={93}
					height={140}
				/>
			) : (
				<Icon size={16} className={styles.type_icon} />
			)}
			<span className={styles.content}>
				<span className={styles.title_row}>
					<span className={styles.target}>{target}</span>
					<span className={styles.date}>{date}</span>
				</span>
				{(action || value) && (
					<span className={styles.meta}>
						{action && <span className={styles.action}>{action}</span>}
						{value && <span className={styles.value}>{value}</span>}
					</span>
				)}
			</span>
		</>
	);

	return (
		<li
			className={`${styles.entry} ${unread ? styles.unread : ""}`}
			style={{ "--stagger-index": index } as CSSProperties}>
			{href === undefined ? (
				<span className={styles.entry_link}>{body}</span>
			) : href ? (
				<Link
					href={href}
					className={styles.entry_link}
					{...(onClick ? { onClick } : {})}>
					{body}
				</Link>
			) : (
				<span className={styles.entry_link} {...(onClick ? { onClick } : {})}>
					{body}
				</span>
			)}
			{unread && <span className={styles.unread_dot} aria-hidden="true" />}
		</li>
	);
}
