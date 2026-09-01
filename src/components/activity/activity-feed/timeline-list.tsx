"use client";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { groupByMonth } from "./group-by-month";
import styles from "./activity-feed.module.sass";

// A gap at least this long between consecutive entries in the same month group gets a divider.
const TIMELINE_GAP_DAYS = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

// Shared grouping/gap-divider/skip-first-label engine for ActivityFeed and
// NotificationFeed — entries must already arrive newest-first. `renderRow`
// returns each entry's <li>, keyed by the caller.
export function TimelineList<T extends { id: string | number; createdAt: Date }>({
	entries,
	renderRow,
}: {
	entries: T[];
	renderRow: (entry: T, index: number) => ReactNode;
}) {
	const groups = groupByMonth(entries);

	return (
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
									{renderRow(entry, index)}
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
	);
}
