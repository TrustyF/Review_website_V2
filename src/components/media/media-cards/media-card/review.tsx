import { Review } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBody,
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
	// Not a Review column — derived from the "watched" MediaChangeLog milestone, the single source of truth for this date.
	watchedDate?: Date | null | undefined;
};

// The rating + "Watched on" pair, split out (no wrapper) so MediaCardShellMobile can place it separately from MediaReviewBody's full-width row.
export function MediaReviewMeta({ review, watchedDate }: Props) {
	if (!review) return null;

	return (
		<>
			<div className={styles.rating}>
				<div className={styles.rating_number}>{review.rating}</div>
				<StarIcon />
			</div>

			{/* "Reviewed on" isn't shown here — it's changelog-only, not duplicated on the card. */}
			{watchedDate && (
				<div className={styles.review_date}>
					Watched on {DateFormatter.format(watchedDate)}
				</div>
			)}
		</>
	);
}

// The review text with its own .body styling, so it still looks right wherever placed (not just inside MediaReview's own wrapper).
export function MediaReviewBody({
	review,
}: {
	review: Review | null | undefined;
}) {
	if (!review?.body) return null;

	// One provider per review so a revealed spoiler doesn't bleed into another review's card.
	return (
		<div className={styles.body}>
			<ReviewSpoilerProvider>
				<ReviewBody text={review.body} paragraphClassName={styles.body_line} />
			</ReviewSpoilerProvider>
		</div>
	);
}

export function MediaReview({ review, watchedDate }: Props) {
	if (!review) return null;

	return (
		<div className={styles.wrapper}>
			<MediaReviewMeta review={review} watchedDate={watchedDate} />
			<MediaReviewBody review={review} />
		</div>
	);
}
