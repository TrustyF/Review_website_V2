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

// Separate copy of group-by-review-month.tsx's grouping since the two group
// different shapes off a different date field.
const MONTH_ICON_SIZE = 17;

// Buckets entries into one group per calendar month — assumes `entries` already
// arrives newest-first (true for getActivityFeed's query).
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
