import Link from "next/link";
import styles from "./list-preview-card.module.sass";

type Props = {
	id: number;
	title: string;
	description: string | null;
	thumbnail: string | null;
	itemCount: number;
};

// Grid item on /lists — thumbnail is an arbitrary pasted URL (see
// list-form.tsx), same reasoning as every other pasted-URL preview in this
// app for using a plain <img> instead of next/image.
export function ListPreviewCard({
	id,
	title,
	description,
	thumbnail,
	itemCount,
}: Props) {
	return (
		<Link href={`/lists/${id}`} className={styles.wrapper}>
			<div className={styles.thumbnail_frame}>
				{thumbnail ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={thumbnail} alt="" className={styles.thumbnail} />
				) : (
					<div className={styles.thumbnail_placeholder}>{title.charAt(0)}</div>
				)}
				<span className={styles.count_badge}>{itemCount}</span>
			</div>
			<div className={styles.title}>{title}</div>
			{description && <div className={styles.description}>{description}</div>}
		</Link>
	);
}
