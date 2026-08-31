import { MediaRecord } from "@/components/media/types";

// "rating" isn't a real sort — it means "use RatedTierGrid's grouped-by-tier view". The other two group by year, newest-first.
export type MediaSortOption = "rating" | "releaseDate" | "watchedDate";

// Excludes "rating", which groupMediaByYear has no meaningful year for.
export type MediaDateSortOption = Exclude<MediaSortOption, "rating">;

export const SORT_OPTIONS: { value: MediaSortOption; label: string }[] = [
	{ value: "rating", label: "Rating" },
	{ value: "releaseDate", label: "Release date" },
	{ value: "watchedDate", label: "Watch date" },
];

function dateFor(media: MediaRecord, option: MediaDateSortOption): Date | null {
	if (option === "releaseDate") return media.releaseDate;
	return media.watchedDate;
}

// Newest first; media missing the chosen date sorts last rather than being dropped.
function sortMediaByDate(
	media: MediaRecord[],
	option: MediaDateSortOption,
): MediaRecord[] {
	return [...media].sort((a, b) => {
		const dateA = dateFor(a, option);
		const dateB = dateFor(b, option);
		if (dateA === null && dateB === null) return 0;
		if (dateA === null) return 1;
		if (dateB === null) return -1;
		return dateB.getTime() - dateA.getTime();
	});
}

export type MediaYearGroup = {
	year: number | null;
	items: MediaRecord[];
};

// Buckets media by calendar year, newest first; media missing that date gets its own group at the end rather than being dropped.
export function groupMediaByYear(
	media: MediaRecord[],
	option: MediaDateSortOption,
): MediaYearGroup[] {
	const sorted = sortMediaByDate(media, option);

	const years = new Map<number | null, MediaRecord[]>();
	for (const item of sorted) {
		const date = dateFor(item, option);
		const year = date ? date.getFullYear() : null;
		const bucket = years.get(year);
		if (bucket) bucket.push(item);
		else years.set(year, [item]);
	}

	return [...years.entries()]
		.sort(([a], [b]) => {
			if (a === null) return 1;
			if (b === null) return -1;
			return b - a;
		})
		.map(([year, items]) => ({ year, items }));
}
