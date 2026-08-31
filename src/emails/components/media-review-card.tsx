import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import { RatingStars } from "./rating-stars";
import { formatReviewBody } from "./format-review-body";

type Props = {
	title: string;
	mediaUrl: string;
	posterSrc: string;
	releaseYear: string | null;
	rating: number | null;
	watchedDateLabel: string | null;
	body: string | null;
};

// Email counterpart to MediaCardShell + MediaReview. Uses Row/Column
// (renders as an HTML table) instead of flexbox, since mail clients like
// Outlook don't support flexbox reliably.
export function MediaReviewCard({
	title,
	mediaUrl,
	posterSrc,
	releaseYear,
	rating,
	watchedDateLabel,
	body,
}: Props) {
	return (
		<Section
			style={{
				backgroundColor: "#1a1a1a",
				borderRadius: "8px",
				padding: "20px",
			}}>
			<Row>
				<Column style={{ width: "130px", verticalAlign: "top" }}>
					<Link href={mediaUrl}>
						<Img
							src={posterSrc}
							width={110}
							height={165}
							alt={title}
							style={{ borderRadius: "4px", display: "block" }}
						/>
					</Link>
				</Column>
				<Column style={{ verticalAlign: "top", paddingLeft: "20px" }}>
					<Link href={mediaUrl} style={{ textDecoration: "none" }}>
						<Text style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ededed" }}>
							{title}
							{releaseYear && (
								<span style={{ color: "#666666", fontWeight: 400 }}> ({releaseYear})</span>
							)}
						</Text>
					</Link>
					<RatingStars rating={rating} />
					{watchedDateLabel && (
						<Text style={{ margin: "4px 0 12px", fontSize: "12px", color: "#666666" }}>
							Watched on {watchedDateLabel}
						</Text>
					)}
					{body && formatReviewBody(body)}
				</Column>
			</Row>
		</Section>
	);
}
