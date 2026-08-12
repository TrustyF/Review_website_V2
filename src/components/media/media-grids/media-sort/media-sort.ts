import { MediaRecord } from "@/components/media/types";

// "rating" isn't a real sort here — it means "use RatedTierGrid's own
// grouped-by-tier view" (MediaFilterGrid's default), not a flat sort. The
// other two group by year, ordered newest-first, through
// MediaSortedGrid/groupMediaByYear below.
export type MediaSortOption = "rating" | "releaseDate" | "watchedDate";

// The two options that actually have a date to group by — excludes
// "rating", which groupMediaByYear has no meaningful year for.
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

// Newest first; media with no value for the chosen date (e.g. unwatched, for
// "watchedDate") sorts last rather than being dropped — same "missing value
// loses" convention RatedTierGrid uses for unrated media.
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

// Buckets media by the chosen date's calendar year, newest year first —
// media with no value for that date (same cases sortMediaByDate sends last)
// get their own group at the very end rather than being silently dropped,
// same convention RatedTierGrid uses for its own "Unrated" tier.
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
