import styles from "./stats-section.module.sass";

type Props = {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	className?: string;
};

// Bordered card + heading shell every stats-page chart section shares.
export function StatsSection({ title, subtitle, children, className }: Props) {
	return (
		<section className={`${styles.section} ${className ?? ""}`}>
			<div className={styles.heading}>
				<h2 className={styles.title}>{title}</h2>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
			</div>
			{children}
		</section>
	);
}
