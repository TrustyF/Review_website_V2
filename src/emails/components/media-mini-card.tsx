import { Column, Img, Link, Text } from "@react-email/components";

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
		<Column style={{ width: "110px", verticalAlign: "top", paddingRight: "12px" }}>
			<Link href={mediaUrl}>
				<Img
					src={posterSrc}
					width={100}
					height={150}
					alt={title}
					style={{ borderRadius: "4px", display: "block" }}
				/>
			</Link>
			<Link href={mediaUrl} style={{ textDecoration: "none" }}>
				<Text
					style={{
						margin: "6px 0 2px",
						fontSize: "12px",
						fontWeight: 500,
						color: "#ededed",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						maxWidth: "100px",
					}}>
					{title}
				</Text>
			</Link>
			{rating != null && (
				<Text style={{ margin: 0, fontSize: "11px", color: "#ededed" }}>
					<span style={{ color: "#FCCA00" }}>★</span> {rating.toFixed(1)}
				</Text>
			)}
		</Column>
	);
}
