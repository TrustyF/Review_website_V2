import { Calendar } from "lucide-react";
import type { ActivityFeedEntry } from "@/components/activity/activity-actions";

export type ActivityGroup = {
	key: string;
	label: React.ReactNode;
	entries: ActivityFeedEntry[];
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
});

// Same glyph + label format as group-by-review-month.tsx's own month
// grouping on the Reviews page — kept as a separate copy rather than a
// shared helper since the two group different shapes (MediaRecord there,
// ActivityFeedEntry here) off a different date field.
const MONTH_ICON_SIZE = 17;

// Buckets entries into one group per calendar month — assumes `entries`
// already arrives newest-first (true for getActivityFeed's query), same
// walk-once-noticing-boundaries approach as group-by-review-month.tsx.
export function groupByActivityMonth(
	entries: ActivityFeedEntry[],
): ActivityGroup[] {
	const groups: ActivityGroup[] = [];
	for (const entry of entries) {
		const date = entry.createdAt;
		const key = `${date.getFullYear()}-${date.getMonth()}`;
		const last = groups.at(-1);
		if (last?.key === key) {
			last.entries.push(entry);
		} else {
			groups.push({
				key,
				label: (
					<>
						<Calendar size={MONTH_ICON_SIZE} />
						{MONTH_LABEL.format(date)}
					</>
				),
				entries: [entry],
			});
		}
	}
	return groups;
}
