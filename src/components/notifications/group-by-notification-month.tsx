import { Calendar } from "lucide-react";
import type { NotificationEntry } from "@/components/notifications/notification-actions";

export type NotificationGroup = {
	key: string;
	label: React.ReactNode;
	entries: NotificationEntry[];
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
});

const MONTH_ICON_SIZE = 17;

// Same walk-once-noticing-boundaries bucketing as activity-feed's own
// group-by-activity-month.tsx — kept as a separate copy rather than a shared
// helper since the two group a different entry shape off a different date
// field, same reasoning that file's own comment gives for not sharing with
// group-by-review-month.tsx either. Assumes `entries` already arrives
// newest-first (true for getNotifications's query).
export function groupByNotificationMonth(
	entries: NotificationEntry[],
): NotificationGroup[] {
	const groups: NotificationGroup[] = [];
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
