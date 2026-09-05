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
		<Section className="rounded-[10px] pt-5 pb-5">
			<Row>
				<Column className="w-[130px] align-top">
					<Link href={mediaUrl}>
						<Img
							src={posterSrc}
							width={110}
							height={165}
							alt={title}
							className="block rounded"
						/>
					</Link>
				</Column>
				<Column className="pl-2 align-top">
					<Link href={mediaUrl} className="no-underline">
						<Text className="m-0 text-[18px] font-medium text-fg">{title}</Text>
					</Link>
					<RatingStars rating={rating} releaseYear={releaseYear} />
					{body && formatReviewBody(body, mediaUrl)}
				</Column>
			</Row>
		</Section>
	);
}
