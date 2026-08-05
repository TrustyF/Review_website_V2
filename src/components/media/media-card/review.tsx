import { Review } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import styles from "./review.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

export function MediaReview({ review }: { review: Review | null | undefined }) {
	if (!review) return null;

	const SplitLineBody = review.body
		? review.body.split("\n\n").map((line, index) => (
				<p
					className={styles.body_line}
					key={index}
				>
					{line}
				</p>
			))
		: null;

	return (
		<div className={styles.wrapper}>
			<div className={styles.rating}>
				<div className={styles.rating_number}>{review.rating}</div>
				<StarIcon className={styles.rating_star} />
			</div>

			<div className={styles.watched_on}>
				watched {DateFormatter.format(review.createDate)}
			</div>

			<div className={styles.body}>{SplitLineBody}</div>
		</div>
	);
}
