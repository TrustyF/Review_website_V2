import styles from "./stats-section.module.sass";

type Props = {
	title: string;
	subtitle?: string;
	// Rendered top-right of the heading row (e.g. a mode toggle) — omitted
	// leaves the heading as a plain single-column title/subtitle stack.
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
};

// Bordered card + heading shell every stats-page chart section shares.
export function StatsSection({
	title,
	subtitle,
	actions,
	children,
	className,
}: Props) {
	return (
		<section className={`${styles.section} ${className ?? ""}`}>
			<div className={styles.heading}>
				<div className={styles.heading_text}>
					<h2 className={styles.title}>{title}</h2>
					{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
				</div>
				{actions}
			</div>
			{children}
		</section>
	);
}
