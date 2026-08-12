import { Calendar, CalendarCheck, Star } from "lucide-react";
import { MediaSortOption } from "@/components/media/media-grids/media-sort/media-sort";

type Props = {
	option: MediaSortOption;
	size?: number;
};

// Shared by MediaSortPopover (one icon per menu row) and MediaSortedGrid
// (the same icon again on each year-group header when sorted by date) —
// same "what does this sort mean" glyph wherever the sort shows up, not
// just at the point you picked it. "Watch date" gets the check variant
// (done/completed reads closer to "watched") instead of sharing Calendar
// with "Release date".
export function MediaSortIcon({ option, size = 14 }: Props) {
	if (option === "rating") return <Star size={size} />;
	if (option === "releaseDate") return <Calendar size={size} />;
	return <CalendarCheck size={size} />;
}
