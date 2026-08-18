import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { groupByActivityMonth } from "./group-by-activity-month";
import styles from "./activity-feed.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

// Same timeline-gap-divider treatment as change-log-list.tsx — a gap at
// least this long between two consecutive entries (within the same month
// group; the sticky month header already marks a break across groups) gets
// a divider instead of the list just running the two together.
const TIMELINE_GAP_DAYS = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

// Same unit-stepping as change-log-list.tsx's own formatGap.
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

// One icon per ActivityType — RATING_CHANGED reuses the same star the
// rating value itself renders with elsewhere (change-log-list.tsx), so a
// glance at the icon column already hints at what kind of row it is before
// reading the text.
const TYPE_ICON = {
	RATED: StarIcon,
	RATING_CHANGED: StarIcon,
	REVIEWED: PenLine,
	REWATCHED: RotateCcw,
	WATCHLIST_ADDED: WatchlistIcon,
	LIST_CREATED: ListPlus,
	// Never actually rendered — LIST_ITEM_ADDED always carries a media row
	// (see addMediaToList), so ActivityRow's poster branch wins instead —
	// still needs an entry so the Record below stays exhaustive.
	LIST_ITEM_ADDED: ListPlus,
} as const;

// Same value + star pairing as change-log-list.tsx's own ChangeValue
// "rating" branch — kept a local copy rather than importing that function
// since it's the one field this feed renders a value for at all (every
// other type is self-describing from its label alone). `old` mirrors that
// same file's .old_value/.new_value split (accent + strikethrough vs. plain)
// — only ever passed for RATING_CHANGED's oldValue side, RATED/REVIEWED's
// single value is always "current" and never struck through.
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

// Which way the arrow should read, for RATING_CHANGED's own arrow color —
// null (equal, or either side unparseable) leaves it at its neutral default
// rather than guessing a direction that isn't real.
function ratingDirection(
	oldValue: string | null,
	newValue: string | null,
): "up" | "down" | null {
	const from = oldValue === null ? NaN : Number(oldValue);
	const to = newValue === null ? NaN : Number(newValue);
	if (Number.isNaN(from) || Number.isNaN(to) || from === to) return null;
	return to > from ? "up" : "down";
}

// The one bit of each row that actually goes somewhere — styled apart from
// the surrounding action text (see .action) so it reads as the clickable
// part, same idea as a normal sentence-with-a-link.
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

// Every ActivityType boils down to the same "verb + target(s) [+ value]"
// shape — RATED/REVIEWED/RATING_CHANGED/WATCHLIST_ADDED target a media,
// LIST_CREATED a list, LIST_ITEM_ADDED both at once. Returning that shape
// as three separate pieces (rather than one pre-joined ReactNode) is what
// lets ActivityRow lay them out on two separate lines next to the poster
// (title+date, then action+value below it — see .content/.title_row/.meta)
// instead of one flowing sentence.
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
				// REWATCHED always carries a media (see logRewatch), so
				// ActivityRow's poster branch always wins over TYPE_ICON's
				// RotateCcw — same reason LIST_ITEM_ADDED's own icon is unreachable
				// (see that entry's comment). Shown in the value spot instead,
				// same pattern as WATCHLIST_ADDED's own icon.
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

function ActivityRow({ entry }: { entry: ActivityFeedEntry }) {
	const Icon = TYPE_ICON[entry.type];
	const { action, target, value } = activityLabel(entry);

	return (
		<li className={styles.entry}>
			{entry.media ? (
				<Image
					className={styles.poster}
					src={entry.media.posterSrc}
					alt=""
					// Matches resolveChangelogPosterThumb's actual on-disk size
					// (THUMB_MAX_HEIGHT=140, ~93 wide) rather than an approximate
					// 2:3 — .poster's own height:100%/width:auto/object-fit:contain
					// governs the rendered size regardless, this just keeps Next's
					// intrinsic aspect ratio true to the cached file.
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

export function ActivityFeed({ entries }: { entries: ActivityFeedEntry[] }) {
	if (entries.length === 0) {
		return <div className={styles.empty}>No activity recorded yet.</div>;
	}

	const groups = groupByActivityMonth(entries);

	return (
		<div className={styles.groups}>
			{groups.map((group) => (
				<details key={group.key} open>
					<summary className={styles.group_header}>{group.label}</summary>
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
										<li className={styles.timeline_gap} aria-hidden="true">
											<span className={styles.timeline_gap_line} />
										</li>
									)}
									<ActivityRow entry={entry} />
								</Fragment>
							);
						})}
					</ul>
				</details>
			))}
		</div>
	);
}
