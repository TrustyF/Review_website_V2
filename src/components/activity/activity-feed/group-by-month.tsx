import { Calendar } from "lucide-react";

export type TimelineGroup<T> = {
	key: string;
	label: React.ReactNode;
	entries: T[];
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
});

const MONTH_ICON_SIZE = 17;

// Buckets entries into one group per calendar month — assumes `entries` already
// arrives newest-first. Shared by ActivityFeed and NotificationFeed, which both
// group a differently-shaped entry off its own createdAt.
export function groupByMonth<T extends { createdAt: Date }>(
	entries: T[],
): TimelineGroup<T>[] {
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
						{MONTH_LABEL.format(date)}
					</>
				),
				entries: [entry],
			});
		}
	}
	return groups;
}
