import { Calendar, CalendarCheck, Star } from "lucide-react";
import { MediaSortOption } from "@/components/media/media-grids/media-sort/media-sort";

type Props = {
	option: MediaSortOption;
	size?: number;
};

// Same glyph wherever a sort shows up (menu row, year-group header). "Watch date" gets the check variant (reads as "watched") instead of sharing Calendar.
export function MediaSortIcon({ option, size = 14 }: Props) {
	if (option === "rating") return <Star size={size} />;
	if (option === "releaseDate") return <Calendar size={size} />;
	return <CalendarCheck size={size} />;
}
