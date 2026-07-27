import { Review } from "@prisma/client";
import styles from "./review.module.sass";
import Image from "next/image";

export function MediaReview({ review }: { review: Review | null | undefined }) {
	if (!review) return null;
	return (
		<div className={styles.wrapper}>
			<div className={styles.rating}>
				<div className={styles.rating_number}>{review.rating}</div>
				<Image
					src={"/ui/gold_star.webp"}
					alt={"gold star"}
					width={51}
					height={51}
					className={styles.gold_star}
				/>
			</div>
			<div className={styles.body}>{review.body}</div>
		</div>
	);
}
