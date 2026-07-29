import styles from "./primitives.module.sass";

export function MediaTitle({
	title,
	className,
}: {
	title: string;
	className?: string | undefined;
}) {
	if (!title) return null;
	return (
		<div className={[styles.title, className].filter(Boolean).join(" ")}>
			{title}
		</div>
	);
}
