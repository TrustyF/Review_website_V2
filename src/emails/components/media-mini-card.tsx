import { Column, Img, Link, Text } from "@react-email/components";
import { formatRating } from "../lib/format-rating";
import { StarGlyph } from "./star-glyph";

type Props = {
	title: string;
	mediaUrl: string;
	posterSrc: string;
	rating: number | null;
};

// Email counterpart to MediaMiniCardShell, minus site-only affordances.
// Renders as a bare <Column> so several can sit in one parent <Row>.
export function MediaMiniCard({ title, mediaUrl, posterSrc, rating }: Props) {
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
			<Link href={mediaUrl} className="no-underline">
				<Text className="m-0 mt-0.5 max-w-[100px] truncate text-[13px] font-medium text-fg">
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
