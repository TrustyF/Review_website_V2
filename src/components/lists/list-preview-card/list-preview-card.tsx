import { Link } from "@/components/ui/link";
import styles from "./list-preview-card.module.sass";

type Props = {
	id: number;
	title: string;
	description: string | null;
	thumbnail: string | null;
	itemCount: number;
	// false renders a plain div instead of a Link, for use nested inside another Link (anchors can't nest).
	linked?: boolean;
};

// Grid item on /lists — thumbnail is an arbitrary pasted URL, hence plain <img> instead of next/image.
export function ListPreviewCard({
	id,
	title,
	description,
	thumbnail,
	itemCount,
	linked = true,
}: Props) {
	const content = (
		<>
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
		</>
	);

	if (!linked) return <div className={styles.wrapper}>{content}</div>;

	return (
		<Link href={`/lists/${id}`} className={styles.wrapper}>
			{content}
		</Link>
	);
}
