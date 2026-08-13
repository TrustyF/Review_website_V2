import { Calendar } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { MediaGroup } from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";

// Same "reviewDate, falling back to createDate" definition AllReviewsListPage's
// own query sorts by — keeps the grouping consistent with the flat order the
// list already renders in.
function reviewMonthDate(media: MediaRecord): Date | null {
	return media.review?.reviewDate ?? media.review?.createDate ?? null;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
});

// Same glyph MediaSortIcon uses for "releaseDate" — this is a date-based
// group header too, just not driven by that component's own MediaSortOption,
// so it's simplest to use the plain icon directly rather than stretching
// that option type to cover a grouping it doesn't otherwise know about.
const MONTH_ICON_SIZE = 17;

// Buckets media into one group per calendar month, newest first. Assumes
// `media` already arrives sorted newest-first by the same date (true for
// AllReviewsListPage's query) — walks it once noticing month boundaries
// rather than re-sorting, unlike media-sort.ts's groupMediaByYear (which
// sorts its own input since callers there hand it an arbitrary MediaSortOption).
export function groupMediaByReviewMonth(media: MediaRecord[]): MediaGroup[] {
	const groups: MediaGroup[] = [];
	for (const item of media) {
		const date = reviewMonthDate(item);
		const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "unknown";
		const last = groups.at(-1);
		if (last?.key === key) {
			last.items.push(item);
		} else {
			groups.push({
				key,
				label: (
					<>
						<Calendar size={MONTH_ICON_SIZE} />
						{date ? MONTH_LABEL.format(date) : "Unknown"}
					</>
				),
				items: [item],
			});
		}
	}
	return groups;
}
