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
	// Not a Review column — derived from the "watched" MediaChangeLog
	// milestone (see saveReview/toMediaRecord), since that's the single
	// source of truth "Reviewed on"/"Rewatched on" also read from in the
	// changelog itself, instead of duplicating a date on the review row too.
	watchedDate?: Date | null | undefined;
};

// The rating + "Watched on" pair, with no wrapper of its own — split out so
// MediaCardShellMobile (see that file's own comment) can place this beside
// the poster while MediaReviewBody below sits in a separate full-width row,
// instead of the two only ever coming as one fixed block. MediaReview
// (below) still renders both together for MediaCardShell's own desktop
// layout, unchanged from before this split.
export function MediaReviewMeta({ review, watchedDate }: Props) {
	if (!review) return null;

	return (
		<>
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
		</>
	);
}

// Just the review text itself, including its own .body styling (color/font/
// line-height/spacing) — see MediaReviewMeta's own comment on why this is
// separate. Carries that styling itself, rather than leaving it to a
// wrapper only MediaReview's own desktop composition below provides, so it
// still looks like review text wherever else it's placed (see
// MediaCardShellMobile's own full-width row for it).
export function MediaReviewBody({
	review,
}: {
	review: Review | null | undefined;
}) {
	if (!review?.body) return null;

	// One provider per review — clicking any spoiler reveals every spoiler
	// in this review, but never bleeds into another media item's review
	// rendered elsewhere on the same page (e.g. a grid of cards).
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
