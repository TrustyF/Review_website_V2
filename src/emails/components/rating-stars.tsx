import { Text } from "@react-email/components";

// Plain Unicode glyph, not inline SVG like star-icon.tsx — Outlook's
// Word-based renderer strips <svg> entirely.
const STAR_COLOR = "#FCCA00";

export function RatingStars({
	rating,
	fontSize = "14px",
}: {
	rating: number | null;
	fontSize?: string;
}) {
	if (rating == null) return null;
	return (
		<Text
			style={{
				margin: 0,
				fontSize,
				fontWeight: 700,
				color: "#ededed",
			}}>
			<span style={{ color: STAR_COLOR }}>★</span> {rating.toFixed(1)}
		</Text>
	);
}
