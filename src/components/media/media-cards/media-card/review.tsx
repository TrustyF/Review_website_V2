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

// Extra classes a caller can add on top of each piece's own default styling —
// e.g. the mobile detail header sizing text down without touching the shared
// review.module.sass defaults every other caller (media cards, etc.) relies on.
type ClassNameOverrides = {
	ratingClassName?: string | undefined;
	dateClassName?: string | undefined;
	bodyClassName?: string | undefined;
};

// The rating + "Watched on" pair, split out (no wrapper) so MediaCardShellMobile can place it separately from MediaReviewBody's full-width row.
// Client Component so review-body-edit-trigger.tsx (admin, "use client") can still import it directly.
export function MediaReviewMeta({
	review,
	watchedDate,
	type,
	ratingClassName,
	dateClassName,
}: Props & Pick<ClassNameOverrides, "ratingClassName" | "dateClassName">) {
	const dict = useDictionary();
	const locale = useLocale();
	if (!review) return null;

	return (
		<>
			<div className={styles.rating}>
				<div className={`${styles.rating_number} ${ratingClassName ?? ""}`}>
					{review.rating}
				</div>
				<StarIcon />
			</div>

			{/* "Reviewed on" isn't shown here — it's changelog-only, not duplicated on the card. */}
			{watchedDate && (
				<div className={`${styles.review_date} ${dateClassName ?? ""}`}>
					{watchedOnLabel(type, dict)} {dateFormatterFor(locale).format(watchedDate)}
				</div>
			)}
		</>
	);
}

// The review text with its own .body styling, so it still looks right wherever placed (not just inside MediaReview's own wrapper).
export function MediaReviewBody({
	review,
	bodyClassName,
}: {
	review: Review | null | undefined;
} & Pick<ClassNameOverrides, "bodyClassName">) {
	const locale = useLocale();
	// Falls back to English silently when no French translation has been
	// written yet — see Review.bodyFr in rating.prisma.
	const text = locale === "fr" ? (review?.bodyFr ?? review?.body) : review?.body;
	if (!text) return null;

	// One provider per review so a revealed spoiler doesn't bleed into another review's card.
	return (
		<div className={`${styles.body} ${bodyClassName ?? ""}`}>
			<ReviewSpoilerProvider>
				<ReviewBody text={text} paragraphClassName={styles.body_line} />
			</ReviewSpoilerProvider>
		</div>
	);
}

export function MediaReview({
	review,
	watchedDate,
	type,
	ratingClassName,
	dateClassName,
	bodyClassName,
}: Props & ClassNameOverrides) {
	if (!review) return null;

	return (
		<div className={styles.wrapper}>
			<MediaReviewMeta
				review={review}
				watchedDate={watchedDate}
				type={type}
				ratingClassName={ratingClassName}
				dateClassName={dateClassName}
			/>
			<MediaReviewBody review={review} bodyClassName={bodyClassName} />
		</div>
	);
}

const ReleaseDateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

// A confirmed future date, or an announced title with no date yet — see
// isUpcomingRelease in app/media/[id]/page.tsx for the actual rule.
export function UpcomingReviewPlaceholder({
	date,
}: {
	date: Date | null | undefined;
}) {
	return (
		<div className={styles.upcoming}>
			{date ? `Releasing ${ReleaseDateFormatter.format(date)}` : "Not yet released"}
		</div>
	);
}

// Read-only review, no edit affordance — ReviewBodyEditTrigger's non-admin
// fallback, and used directly by the mobile header (which never edits).
export function MediaReviewDisplay({
	review,
	watchedDate,
	type,
	releaseDate,
	isUpcoming,
	ratingClassName,
	dateClassName,
	bodyClassName,
}: Props & {
	releaseDate: Date | null | undefined;
	isUpcoming: boolean;
} & ClassNameOverrides) {
	if (!review && isUpcoming) {
		return <UpcomingReviewPlaceholder date={releaseDate} />;
	}
	return (
		<MediaReview
			review={review}
			watchedDate={watchedDate}
			type={type}
			ratingClassName={ratingClassName}
			dateClassName={dateClassName}
			bodyClassName={bodyClassName}
		/>
	);
}
