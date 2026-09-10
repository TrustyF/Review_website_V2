"use client";
import { MediaType, Review } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import { watchedOnLabel } from "@/components/media/media-verb-labels";
import {
	ReviewBody,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import styles from "./review.module.sass";

function dateFormatterFor(locale: string) {
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

type Props = {
	review: Review | null | undefined;
	// Not a Review column — derived from the "watched" MediaChangeLog milestone, the single source of truth for this date.
	watchedDate?: Date | null | undefined;
	type: MediaType;
};

// The rating + "Watched on" pair, split out (no wrapper) so MediaCardShellMobile can place it separately from MediaReviewBody's full-width row.
// Client Component so review-body-edit-trigger.tsx (admin, "use client") can still import it directly.
export function MediaReviewMeta({ review, watchedDate, type }: Props) {
	const dict = useDictionary();
	const locale = useLocale();
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
					{watchedOnLabel(type, dict)} {dateFormatterFor(locale).format(watchedDate)}
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
	const locale = useLocale();
	// Falls back to English silently when no French translation has been
	// written yet — see Review.bodyFr in rating.prisma.
	const text = locale === "fr" ? (review?.bodyFr ?? review?.body) : review?.body;
	if (!text) return null;

	// One provider per review so a revealed spoiler doesn't bleed into another review's card.
	return (
		<div className={styles.body}>
			<ReviewSpoilerProvider>
				<ReviewBody text={text} paragraphClassName={styles.body_line} />
			</ReviewSpoilerProvider>
		</div>
	);
}

export function MediaReview({ review, watchedDate, type }: Props) {
	if (!review) return null;

	return (
		<div className={styles.wrapper}>
			<MediaReviewMeta review={review} watchedDate={watchedDate} type={type} />
			<MediaReviewBody review={review} />
		</div>
	);
}
