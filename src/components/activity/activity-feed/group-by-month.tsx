import { Calendar } from "lucide-react";

export type TimelineGroup<T> = {
	key: string;
	label: React.ReactNode;
	entries: T[];
};

const MONTH_ICON_SIZE = 17;

// Buckets entries into one group per calendar month, assuming `entries` already
// arrives newest-first. Shared by ActivityFeed and NotificationFeed.
export function groupByMonth<T extends { createdAt: Date }>(
	entries: T[],
	locale: string,
): TimelineGroup<T>[] {
	const monthLabel = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
		month: "long",
		year: "numeric",
	});
	const groups: TimelineGroup<T>[] = [];
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
						{monthLabel.format(date)}
					</>
				),
				entries: [entry],
			});
		}
	}
	return groups;
}
