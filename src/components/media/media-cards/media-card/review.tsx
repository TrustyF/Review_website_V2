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

type Props = {
	review: Review | null | undefined;
	// Not a Review column — derived from the "watched" MediaChangeLog
	// milestone (see saveReview/toMediaRecord), since that's the single
	// source of truth "Reviewed on"/"Rewatched on" also read from in the
	// changelog itself, instead of duplicating a date on the review row too.
	watchedDate?: Date | null;
};

export function MediaReview({ review, watchedDate }: Props) {
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

			{/* "Reviewed on" isn't shown here — see saveReview's comment: it's
			    changelog-only, alongside "watched" itself, rather than
			    duplicated on the card too. */}
			{watchedDate && (
				<div className={styles.review_date}>
					Watched on {DateFormatter.format(watchedDate)}
				</div>
			)}

			<div className={styles.body}>{SplitLineBody}</div>
		</div>
	);
}
