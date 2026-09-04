import { Text } from "@react-email/components";
import { formatRating } from "../lib/format-rating";
import { StarGlyph } from "./star-glyph";

export function RatingStars({
	rating,
	releaseYear,
	fontSize = "14px",
}: {
	rating: number | null;
	releaseYear?: string | null;
	fontSize?: string;
}) {
	if (rating == null && !releaseYear) return null;
	return (
		<Text className="m-0 font-medium text-fg" style={{ fontSize }}>
			{releaseYear && (
				<span className="font-normal text-fg-3">{releaseYear}</span>
			)}
			{rating != null && releaseYear && (
				<span className="font-normal text-fg-3"> · </span>
			)}
			{rating != null && (
				<>
					{formatRating(rating)} <StarGlyph size={11} />
				</>
			)}
		</Text>
	);
}
