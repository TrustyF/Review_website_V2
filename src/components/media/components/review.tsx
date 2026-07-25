import { Review } from "@prisma/client";
import styles from "../components/review.module.sass";

export function MediaReview({ review }: { review: Review | null | undefined }) {
	if (!review) return null;
	return (
		<div className={styles.wrapper}>
			<div className={styles.rating}>{review.rating + "/10"}</div>
			<div className={styles.body}>{review.body}</div>
		</div>
	);
}
