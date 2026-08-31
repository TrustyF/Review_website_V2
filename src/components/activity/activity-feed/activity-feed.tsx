"use client";
import { Fragment, type CSSProperties } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import {
	ArrowRight,
	IterationCw,
	ListPlus,
	PenLine,
	RotateCcw,
} from "lucide-react";
import { StarIcon } from "@/components/media/icons/star-icon";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import type { ActivityFeedEntry } from "@/components/activity/activity-actions";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import { groupByActivityMonth } from "./group-by-activity-month";
import styles from "./activity-feed.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

// A gap at least this long between consecutive entries in the same month group gets a divider.
const TIMELINE_GAP_DAYS = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

function formatGap(days: number): string {
	const rounded = Math.round(days);
	if (rounded < 30) {
		return `${rounded} day${rounded === 1 ? "" : "s"} later`;
	}
	const months = Math.round(days / 30.44);
	if (months < 12) {
		return `${months} month${months === 1 ? "" : "s"} later`;
	}
	const years = Math.round(days / 365.25);
	return `${years} year${years === 1 ? "" : "s"} later`;
}

// One icon per ActivityType — RATING_CHANGED reuses the star rating value's own icon.
const TYPE_ICON = {
	RATED: StarIcon,
	RATING_CHANGED: StarIcon,
	REVIEWED: PenLine,
	REWATCHED: RotateCcw,
	WATCHLIST_ADDED: WatchlistIcon,
	LIST_CREATED: ListPlus,
	// Never actually rendered — LIST_ITEM_ADDED always carries media, so the poster wins.
	LIST_ITEM_ADDED: ListPlus,
} as const;

// `old` (accent + strikethrough vs. plain) is only ever passed for RATING_CHANGED's
// oldValue side — RATED/REVIEWED's single value is always current, never struck through.
function RatingValue({
	value,
	old = false,
}: {
	value: string | null;
	old?: boolean;
}) {
	if (value === null) return <>—</>;
	return (
		<span
			className={`${styles.rating_value} ${old ? styles.rating_value_old : ""}`}>
			<span className={old ? styles.value_old : undefined}>{value}</span>
			{!old && <StarIcon size={10} />}
		</span>
	);
}

// null (equal, or either side unparseable) leaves the arrow at its neutral default.
function ratingDirection(
	oldValue: string | null,
	newValue: string | null,
): "up" | "down" | null {
	const from = oldValue === null ? NaN : Number(oldValue);
	const to = newValue === null ? NaN : Number(newValue);
	if (Number.isNaN(from) || Number.isNaN(to) || from === to) return null;
	return to > from ? "up" : "down";
}

// The one bit of each row that actually goes somewhere — styled apart from the
// surrounding action text so it reads as the clickable part.
function MediaLink({
	media,
}: {
	media: NonNullable<ActivityFeedEntry["media"]>;
}) {
	return (
		<Link href={`/media/${media.id}`} className={styles.title_link}>
			{media.title}
		</Link>
	);
}

function ListLink({ list }: { list: NonNullable<ActivityFeedEntry["list"]> }) {
	return (
		<Link href={`/lists/${list.id}`} className={styles.title_link}>
			{list.title}
		</Link>
	);
}

// Returns "verb + target(s) [+ value]" as three separate pieces (not one joined
// ReactNode) so ActivityRow can lay them out on two lines next to the poster.
function activityLabel(entry: ActivityFeedEntry): {
	action: string | null;
	target: React.ReactNode;
	value: React.ReactNode;
} {
	switch (entry.type) {
		case "RATED":
			return {
				action: null,
				target: entry.media && <MediaLink media={entry.media} />,
				value: <RatingValue value={entry.newValue} />,
			};
		case "REVIEWED":
			return {
				action: "Reviewed",
				target: entry.media && <MediaLink media={entry.media} />,
				value: <RatingValue value={entry.newValue} />,
			};
		case "REWATCHED":
			return {
				action: "Rewatched",
				target: entry.media && <MediaLink media={entry.media} />,
				// REWATCHED always carries media, so the poster wins over TYPE_ICON's
				// RotateCcw — shown in the value spot instead, like WATCHLIST_ADDED's icon.
				value: <IterationCw size={14} className={styles.value_icon} />,
			};
		case "RATING_CHANGED": {
			const direction = ratingDirection(entry.oldValue, entry.newValue);
			return {
				action: null,
				target: entry.media && <MediaLink media={entry.media} />,
				value: (
					<span className={styles.value_change}>
						<RatingValue value={entry.oldValue} old />
						<ArrowRight
							size={12}
							className={`${styles.arrow_icon} ${direction ? styles[`arrow_${direction}`] : ""}`}
						/>
						<RatingValue value={entry.newValue} />
					</span>
				),
			};
		}
		case "WATCHLIST_ADDED":
			return {
				action: "Watchlisted",
				target: entry.media && <MediaLink media={entry.media} />,
				value: <WatchlistIcon size={14} className={styles.value_icon} />,
			};
		case "LIST_CREATED":
			return {
				action: "Created list",
				target: entry.list && <ListLink list={entry.list} />,
				value: null,
			};
		case "LIST_ITEM_ADDED":
			return {
				action: "Added to",
				target: entry.media && <MediaLink media={entry.media} />,
				value: entry.list && <ListLink list={entry.list} />,
			};
	}
}

// index is this row's position within its own month group (not global), passed
// through to --stagger-index for .entry's animation-delay.
function ActivityRow({
	entry,
	index,
}: {
	entry: ActivityFeedEntry;
	index: number;
}) {
	const Icon = TYPE_ICON[entry.type];
	const { action, target, value } = activityLabel(entry);

	return (
		<li
			className={styles.entry}
			style={{ "--stagger-index": index } as CSSProperties}>
			{entry.media ? (
				<Image
					className={styles.poster}
					src={entry.media.posterSrc}
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
					<span className={styles.date}>
						{DateFormatter.format(entry.createdAt)}
					</span>
				</span>
				<span className={styles.meta}>
					{action && <span className={styles.action}>{action}</span>}
					<span className={styles.value}>{value}</span>
				</span>
			</span>
		</li>
	);
}

// Dialed separately from useLazyReveal's own 24-item default — a row here is a
// different shape/weight than a grid card or review card.
const ACTIVITY_BATCH_SIZE = 10;

export function ActivityFeed({ entries }: { entries: ActivityFeedEntry[] }) {
	// Same reveal-more-on-scroll pattern as LazyMediaGrid/LazyMediaList — avoids
	// mounting up to ~700 rows (each with its own poster Image) up front.
	const { visibleCount, sentinelRef } = useLazyReveal(
		entries,
		"activity",
		ACTIVITY_BATCH_SIZE,
	);
	const visibleEntries = entries.slice(0, visibleCount);

	if (entries.length === 0) {
		return <div className={styles.empty}>No activity recorded yet.</div>;
	}

	const groups = groupByActivityMonth(visibleEntries);

	return (
		<>
			<div className={styles.groups}>
				{groups.map((group, groupIndex) => {
					const list = (
						<ul className={styles.list}>
							{group.entries.map((entry, index) => {
								const prevEntry = group.entries[index - 1];
								const gapDays = prevEntry
									? daysBetween(prevEntry.createdAt, entry.createdAt)
									: 0;
								const showGapDivider = gapDays >= TIMELINE_GAP_DAYS;

								return (
									<Fragment key={entry.id}>
										{showGapDivider && (
											<li
												className={styles.timeline_gap}
												aria-hidden="true"
												style={{ "--stagger-index": index } as CSSProperties}>
												<span className={styles.timeline_gap_line} />
											</li>
										)}
										<ActivityRow entry={entry} index={index} />
									</Fragment>
								);
							})}
						</ul>
					);

					// The first group ("this month") is self-evident, so it skips the label.
					if (groupIndex === 0) {
						return <Fragment key={group.key}>{list}</Fragment>;
					}

					return (
						<details key={group.key} open>
							<summary className={styles.group_header}>{group.label}</summary>
							{list}
						</details>
					);
				})}
			</div>
			{visibleCount < entries.length && (
				<div className={styles.sentinel} ref={sentinelRef} />
			)}
		</>
	);
}
