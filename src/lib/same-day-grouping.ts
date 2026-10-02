// Same-day grouping shared by the activity feed and notifications. Members are newest-first;
// members[0] is the representative. axis stays unset while a group has a single member.
export type SameDayGroup<T, A extends string> = { members: T[]; axis?: A };

type GroupableEntry = {
	type: string;
	createdAt: Date;
	list: { id: number } | null;
	media: { id: number } | null;
};

// Merges still-single groups whose keyOf matches on the same calendar day. Groups an earlier
// pass already merged pass through untouched, so passes can be chained by priority.
export function mergeSameDay<T extends { createdAt: Date }, A extends string>(
	groups: SameDayGroup<T, A>[],
	axis: A,
	keyOf: (entry: T) => string | number | null,
): SameDayGroup<T, A>[] {
	const result: SameDayGroup<T, A>[] = [];
	const groupByKey = new Map<string, SameDayGroup<T, A>>();

	for (const group of groups) {
		const entry = group.members[0]!;
		const id = group.members.length === 1 ? keyOf(entry) : null;
		const key = id === null ? null : `${id}-${entry.createdAt.toDateString()}`;
		const existing = key ? groupByKey.get(key) : undefined;

		if (existing) {
			existing.members.push(entry);
			existing.axis = axis;
			continue;
		}

		result.push(group);
		if (key) groupByKey.set(key, group);
	}

	return result;
}

// Same-list additions first (folding in that list's own same-day LIST_CREATED, so it reads as
// one moment), then the inverse — same media added to multiple lists — over what's left.
export function groupListAdditions<T extends GroupableEntry>(
	entries: T[],
): SameDayGroup<T, "list" | "media">[] {
	const byList = mergeSameDay<T, "list" | "media">(
		entries.map((entry) => ({ members: [entry] })),
		"list",
		(e) =>
			(e.type === "LIST_ITEM_ADDED" || e.type === "LIST_CREATED") && e.list
				? e.list.id
				: null,
	);
	return mergeSameDay(byList, "media", (e) =>
		e.type === "LIST_ITEM_ADDED" && e.media && e.list ? e.media.id : null,
	);
}
