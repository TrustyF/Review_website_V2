"use client";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { groupByMonth } from "./group-by-month";
import { useLocale } from "@/lib/i18n/i18n-context";
import styles from "./activity-feed.module.sass";

// A gap at least this long between consecutive entries in the same month group gets a divider.
const TIMELINE_GAP_DAYS = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

// Shared engine for ActivityFeed/NotificationFeed; entries must arrive newest-first
export function TimelineList<
	T extends { id: string | number; createdAt: Date },
>({
	entries,
	renderRow,
	rowGap,
	monthSpacer,
}: {
	entries: T[];
	renderRow: (entry: T, index: number) => ReactNode;
	// Overrides .list's default gap (--row-gap) so NotificationFeed can tune row spacing without affecting ActivityFeed, despite shared engine/stylesheet.
	rowGap?: string;
	// ActivityFeed-only: adds a spacer element after each month's list, before the
	// next month's sticky header.
	monthSpacer?: boolean;
}) {
	const locale = useLocale();
	const groups = groupByMonth(entries, locale);

	return (
		<div className={styles.groups}>
			{groups.map((group, groupIndex) => {
				const list = (
					<ul
						className={styles.list}
						style={rowGap ? ({ "--row-gap": rowGap } as CSSProperties) : undefined}>
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
											<svg
												className={styles.timeline_gap_line}
												viewBox="0 0 4 32"
												preserveAspectRatio="none"
												fill="none">
												<line
													x1="1"
													y1="0"
													x2="1"
													y2="32"
													stroke="currentColor"
													strokeWidth={1}
													strokeLinecap="round"
													strokeDasharray="3 4"
												/>
											</svg>
										</li>
									)}
									{renderRow(entry, index)}
								</Fragment>
							);
						})}
					</ul>
				);

				const spacer = monthSpacer && (
					<div className={styles.month_spacer} aria-hidden="true" />
				);

				// The first group ("this month") is self-evident, so it skips the label.
				if (groupIndex === 0) {
					return (
						<Fragment key={group.key}>
							{list}
							{spacer}
						</Fragment>
					);
				}

				return (
					<details key={group.key} open>
						<summary className={styles.group_header}>{group.label}</summary>
						<hr className={styles.group_divider} />
						{list}
						{spacer}
					</details>
				);
			})}
		</div>
	);
}
