import { Column, Img, Link, Text } from "@react-email/components";
import { formatRating } from "../lib/format-rating";
import { StarGlyph } from "./star-glyph";

type Props = {
	title: string;
	mediaUrl: string;
	posterSrc: string;
	rating: number | null;
	// Anticipated releases (no rating line below) can afford a second title line instead of clipping to one.
	wrapTitle?: boolean;
};

// Email counterpart to MediaMiniCardShell, minus site-only affordances.
// Renders as a bare <Column> so several can sit in one parent <Row>.
export function MediaMiniCard({
	title,
	mediaUrl,
	posterSrc,
	rating,
	wrapTitle,
}: Props) {
	return (
		<Column className="w-[110px] pr-5 align-top">
			<Link href={mediaUrl}>
				<Img
					src={posterSrc}
					width={100}
					height={150}
					alt={title}
					className="block rounded"
				/>
			</Link>
			<Link
				href={mediaUrl}
				className="no-underline"
				// Top offset lives here (padding), not as margin on the Text below — keeps
				// the gap above the title fixed no matter how lineHeight is tuned there.
				style={{ display: "block", paddingTop: 2 }}>
				<Text
					className={`m-0 mt-0.5 max-w-[100px] text-[13px] font-medium text-fg ${wrapTitle ? "" : "truncate"}`}
					style={
						wrapTitle
							? {
									display: "-webkit-box",
									WebkitBoxOrient: "vertical",
									WebkitLineClamp: 3,
									overflow: "hidden",
									lineHeight: 1.5,
								}
							: undefined
					}>
					{title}
				</Text>
			</Link>
			{rating != null && (
				<Text className="m-0 text-[12px] leading-none text-fg-3">
					{formatRating(rating)} <StarGlyph size={12} />
				</Text>
			)}
		</Column>
	);
}
