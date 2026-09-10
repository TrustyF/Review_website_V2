"use client";
import { type CSSProperties } from "react";
import Image from "next/image";
import {
	ArrowRight,
	IterationCw,
	ListPlus,
	PenLine,
	RotateCcw,
} from "lucide-react";
import { StarIcon } from "@/components/media/icons/star-icon";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import { rewatchedVerb } from "@/components/media/media-verb-labels";
import type { ActivityFeedEntry } from "@/components/activity/activity-actions";
import { useLazyReveal } from "@/components/media/media-grids/lazy-media-grid/use-lazy-reveal";
import { Link } from "@/components/ui/link";
import { ListAdditionsCard } from "@/components/notifications/list-additions-card";
import { MediaAdditionsCard } from "@/components/notifications/media-additions-card";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { TimelineList } from "./timeline-list";
import { TimelineRow } from "./timeline-row";
import styles from "./activity-feed.module.sass";

function dateFormatterFor(locale: string) {
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		month: "short",
		day: "numeric",
	});
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
function activityLabel(
	entry: ActivityFeedEntry,
	dict: Dictionary,
): {
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
				action: dict.activity.reviewed,
				target: entry.media && <MediaLink media={entry.media} />,
				value: <RatingValue value={entry.newValue} />,
			};
		case "REWATCHED":
			return {
				action: entry.media
					? rewatchedVerb(entry.media.type, dict)
					: dict.mediaVerb.rewatchedVerb.MOVIE,
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
				action: dict.activity.watchlisted,
				target: entry.media && <MediaLink media={entry.media} />,
				value: <WatchlistIcon size={14} className={styles.value_icon} />,
			};
		case "LIST_CREATED":
			return {
				action: dict.activity.createdList,
				target: entry.list && <ListLink list={entry.list} />,
				value: null,
			};
		case "LIST_ITEM_ADDED":
			return {
				action: dict.activity.addedTo,
				target: entry.media && <MediaLink media={entry.media} />,
				value: entry.list && <ListLink list={entry.list} />,
			};
	}
}

// Header verb for a same-day RATED/REVIEWED/WATCHLIST_ADDED/REWATCHED group — REWATCHED's
// verb depends on media type, so it falls back to the group's representative entry.
function groupLabel(
	type: ActivityFeedEntry["type"],
	dict: Dictionary,
): string | undefined {
	if (type === "RATED") return dict.activity.rated;
	if (type === "REVIEWED") return dict.activity.reviewed;
	if (type === "WATCHLIST_ADDED") return dict.activity.watchlisted;
	return undefined;
}

function typeGroupLabel(entry: ActivityFeedEntry, dict: Dictionary): string {
	if (entry.type === "REWATCHED") {
		return entry.media
			? rewatchedVerb(entry.media.type, dict)
			: dict.mediaVerb.rewatchedVerb.MOVIE;
	}
	return groupLabel(entry.type, dict) ?? entry.type;
}

function ActivityRow({
	entry,
	index,
	dict,
	dateFormatter,
}: {
	entry: ActivityFeedEntry;
	index: number;
	dict: Dictionary;
	dateFormatter: Intl.DateTimeFormat;
}) {
	const { action, target, value } = activityLabel(entry, dict);

	return (
		<TimelineRow
			index={index}
			icon={TYPE_ICON[entry.type]}
			posterSrc={entry.media?.posterSrc}
			target={target}
			date={dateFormatter.format(entry.createdAt)}
			action={action}
			value={value}
		/>
	);
}

// Compact row for a same-day RATED/REVIEWED/WATCHLIST_ADDED/REWATCHED group — icon-only
// header, posters listed below (each links to its own media, no single shared destination).
function TypeGroupRow({
	entry,
	index,
	dict,
	dateFormatter,
}: {
	entry: ActivityFeedEntry;
	index: number;
	dict: Dictionary;
	dateFormatter: Intl.DateTimeFormat;
}) {
	const Icon = TYPE_ICON[entry.type];
	const groupedMedia = entry.groupedMedia ?? [];

	return (
		<li
			className={styles.entry}
			style={{ "--stagger-index": index } as CSSProperties}>
			<div className={styles.group_content}>
				<span className={styles.title_row}>
					<span className={styles.group_title}>
						<Icon size={16} className={styles.type_icon} />
						<span className={styles.target}>{typeGroupLabel(entry, dict)}</span>
					</span>
					<span className={styles.date}>
						{dateFormatter.format(entry.createdAt)}
					</span>
				</span>
				<div className={styles.group_posters}>
					{groupedMedia.map((media) => (
						<Link
							key={media.id}
							href={`/media/${media.id}`}
							className={styles.group_poster_link}>
							<Image
								className={styles.group_poster}
								src={media.posterSrc}
								alt=""
								width={93}
								height={140}
							/>
							{media.value !== null && (
								<span className={styles.group_poster_value}>
									<RatingValue value={media.value} />
								</span>
							)}
						</Link>
					))}
				</div>
			</div>
		</li>
	);
}

// Dialed separately from useLazyReveal's own 24-item default — a row here is a
// different shape/weight than a grid card or review card.
const ACTIVITY_BATCH_SIZE = 10;

export function ActivityFeed({
	entries,
	rowGap,
}: {
	entries: ActivityFeedEntry[];
	rowGap?: string;
}) {
	const dict = useDictionary();
	const locale = useLocale();
	const dateFormatter = dateFormatterFor(locale);
	// Same reveal-more-on-scroll pattern as LazyMediaGrid/LazyMediaList — avoids
	// mounting up to ~700 rows (each with its own poster Image) up front.
	const { visibleCount, sentinelRef } = useLazyReveal(
		entries,
		"activity",
		ACTIVITY_BATCH_SIZE,
	);
	const visibleEntries = entries.slice(0, visibleCount);

	if (entries.length === 0) {
		return <div className={styles.empty}>{dict.activity.empty}</div>;
	}

	return (
		<>
			<TimelineList
				entries={visibleEntries}
				{...(rowGap ? { rowGap } : {})}
				monthSpacer
				renderRow={(entry, index) => {
					if (entry.groupedMedia && entry.groupedMedia.length > 0) {
						// LIST_ITEM_ADDED grouping carries a list; the type-based grouping
						// (RATED/REVIEWED/WATCHLIST_ADDED/REWATCHED) never does.
						if (entry.list) {
							return (
								<ListAdditionsCard
									key={entry.id}
									entry={entry}
									index={index}
									dateFormatter={dateFormatter}
								/>
							);
						}
						return (
							<TypeGroupRow
								key={entry.id}
								entry={entry}
								index={index}
								dict={dict}
								dateFormatter={dateFormatter}
							/>
						);
					}
					if (entry.groupedLists && entry.groupedLists.length > 0) {
						return (
							<MediaAdditionsCard
								key={entry.id}
								entry={entry}
								index={index}
								dateFormatter={dateFormatter}
							/>
						);
					}
					return (
						<ActivityRow
							key={entry.id}
							entry={entry}
							index={index}
							dict={dict}
							dateFormatter={dateFormatter}
						/>
					);
				}}
			/>
			{visibleCount < entries.length && (
				<div className={styles.sentinel} ref={sentinelRef} />
			)}
		</>
	);
}
