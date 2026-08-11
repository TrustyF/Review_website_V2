import { Text } from "@react-email/components";

// Same gold as star-icon.tsx's DEFAULT_STYLE — but a plain Unicode glyph
// instead of that component's inline SVG, since Outlook's Word-based
// renderer strips <svg> entirely; a text star is the one rating treatment
// that's actually safe across every mail client.
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
