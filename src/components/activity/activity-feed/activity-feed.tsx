import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bookmark, ListPlus, PenLine } from "lucide-react";
import { StarIcon } from "@/components/media/icons/star-icon";
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
const TIMELINE_GAP_DAYS = 1;
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
	WATCHLIST_ADDED: Bookmark,
	LIST_CREATED: ListPlus,
	// Never actually rendered — LIST_ITEM_ADDED always carries a media row
	// (see addMediaToList), so ActivityRow's poster branch wins instead —
	// still needs an entry so the Record below stays exhaustive.
	LIST_ITEM_ADDED: ListPlus,
} as const;

// Same value + star pairing as change-log-list.tsx's own ChangeValue
// "rating" branch — kept a local copy rather than importing that function
// since it's the one field this feed renders a value for at all (every
// other type is self-describing from its label alone).
function RatingValue({ value }: { value: string | null }) {
	if (value === null) return <>—</>;
	return (
		<span className={styles.rating_value}>
			{value}
			<StarIcon />
		</span>
	);
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

function ActivityRow({ entry }: { entry: ActivityFeedEntry }) {
	const Icon = TYPE_ICON[entry.type];

	let label: React.ReactNode;

	switch (entry.type) {
		case "RATED":
			label = (
				<>
					<span className={styles.action}>Rated</span>{" "}
					{entry.media && <MediaLink media={entry.media} />}
					<RatingValue value={entry.newValue} />
				</>
			);
			break;
		case "REVIEWED":
			label = (
				<>
					<span className={styles.action}>Reviewed</span>{" "}
					{entry.media && <MediaLink media={entry.media} />}
				</>
			);
			break;
		case "RATING_CHANGED":
			label = (
				<>
					<span className={styles.action}>Rating changed for</span>{" "}
					{entry.media && <MediaLink media={entry.media} />}
					<span className={styles.value_change}>
						<RatingValue value={entry.oldValue} />
						<ArrowRight size={12} className={styles.arrow_icon} />
						<RatingValue value={entry.newValue} />
					</span>
				</>
			);
			break;
		case "WATCHLIST_ADDED":
			label = (
				<>
					<span className={styles.action}>Watchlisted</span>{" "}
					{entry.media && <MediaLink media={entry.media} />}
				</>
			);
			break;
		case "LIST_CREATED":
			label = (
				<>
					<span className={styles.action}>Created list</span>{" "}
					{entry.list && <ListLink list={entry.list} />}
				</>
			);
			break;
		case "LIST_ITEM_ADDED":
			label = (
				<>
					<span className={styles.action}>Added</span>{" "}
					{entry.media && <MediaLink media={entry.media} />}{" "}
					<span className={styles.action}>to</span>{" "}
					{entry.list && <ListLink list={entry.list} />}
				</>
			);
			break;
	}

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
			<span className={styles.label}>{label}</span>
			<span className={styles.date}>
				{DateFormatter.format(entry.createdAt)}
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
											<span className={styles.timeline_gap_label}>
												{formatGap(gapDays)}
											</span>
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
