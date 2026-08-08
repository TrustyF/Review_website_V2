import { Review } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBodyLine,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import styles from "./review.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

export function MediaReview({ review }: { review: Review | null | undefined }) {
	if (!review) return null;

	// One provider per review — clicking any spoiler reveals every spoiler
	// in this review, but never bleeds into another media item's review
	// rendered elsewhere on the same page (e.g. a grid of cards).
	const SplitLineBody = review.body ? (
		<ReviewSpoilerProvider>
			{review.body.split("\n\n").map((line, index) => (
				<p className={styles.body_line} key={index}>
					<ReviewBodyLine text={line} />
				</p>
			))}
		</ReviewSpoilerProvider>
	) : null;

	return (
		<div className={styles.wrapper}>
			<div className={styles.rating}>
				<div className={styles.rating_number}>{review.rating}</div>
				<StarIcon />
			</div>

			{review.ratedDate && (
				<div className={styles.review_date}>
					Watched on {DateFormatter.format(review.ratedDate)}
				</div>
			)}
			{review.reviewedDate && (
				<div className={styles.review_date}>
					Reviewed on {DateFormatter.format(review.reviewedDate)}
				</div>
			)}

			<div className={styles.body}>{SplitLineBody}</div>
		</div>
	);
}
