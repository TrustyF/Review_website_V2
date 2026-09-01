"use client";
import { ArrowRight, IterationCw, ListPlus, PenLine, RotateCcw } from "lucide-react";
import { StarIcon } from "@/components/media/icons/star-icon";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import type { ActivityFeedEntry } from "@/components/activity/activity-actions";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import { Link } from "@/components/ui/link";
import { TimelineList } from "./timeline-list";
import { TimelineRow } from "./timeline-row";
import styles from "./activity-feed.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

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

function ActivityRow({ entry, index }: { entry: ActivityFeedEntry; index: number }) {
	const { action, target, value } = activityLabel(entry);

	return (
		<TimelineRow
			index={index}
			icon={TYPE_ICON[entry.type]}
			posterSrc={entry.media?.posterSrc}
			target={target}
			date={DateFormatter.format(entry.createdAt)}
			action={action}
			value={value}
		/>
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

	return (
		<>
			<TimelineList
				entries={visibleEntries}
				renderRow={(entry, index) => (
					<ActivityRow key={entry.id} entry={entry} index={index} />
				)}
			/>
			{visibleCount < entries.length && (
				<div className={styles.sentinel} ref={sentinelRef} />
			)}
		</>
	);
}
