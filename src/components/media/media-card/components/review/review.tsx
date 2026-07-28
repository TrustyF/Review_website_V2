import { Review } from "@prisma/client";
import styles from "./review.module.sass";
import Image from "next/image";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

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

			<div className={styles.watched_on}>
				watched {DateFormatter.format(review.createDate)}
			</div>

			{/*<div className={styles.body}>{review.body}</div>*/}
			<div className={styles.body}>
				Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus
				ex sapien vitae pellentesque sem placerat. In id cursus mi pretium
				tellus duis convallis. Tempus leo eu aenean sed diam urna tempor.
				Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis
				massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper
			</div>
		</div>
	);
}
