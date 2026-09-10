import { Calendar } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { MediaGroup } from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";
import { Locale } from "@/lib/i18n/get-locale";

// Same "reviewDate, falling back to createDate" definition AllReviewsListPage's query sorts by, so grouping stays consistent with the flat order.
function reviewMonthDate(media: MediaRecord): Date | null {
	return media.review?.reviewDate ?? media.review?.createDate ?? null;
}

// BCP 47 tags, not the dictionary's own locale codes, since this feeds Intl directly.
const MONTH_LABEL_LOCALE: Record<Locale, string> = { en: "en-US", fr: "fr-FR" };

// Same glyph MediaSortIcon uses for "releaseDate" — used directly since this grouping has no MediaSortOption of its own.
const MONTH_ICON_SIZE = 17;

// Buckets media into one group per calendar month, newest first. Assumes `media` already arrives sorted newest-first (true for AllReviewsListPage's query), so it walks once rather than re-sorting like groupMediaByYear does.
export function groupMediaByReviewMonth(
	media: MediaRecord[],
	locale: Locale,
	unknownLabel: string,
): MediaGroup[] {
	const monthLabel = new Intl.DateTimeFormat(MONTH_LABEL_LOCALE[locale], {
		month: "long",
		year: "numeric",
	});

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
						{date ? monthLabel.format(date) : unknownLabel}
					</>
				),
				items: [item],
			});
		}
	}
	return groups;
}
