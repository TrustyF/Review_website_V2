import styles from "./vertical-bar-chart.module.sass";

export type VerticalBarItem = {
	key: string;
	tick: string;
	value: number;
	ariaLabel: string;
	tooltip: string;
};

type Props = {
	items: VerticalBarItem[];
	// CSS color value for every bar — a vertical chart is always a single series.
	color?: string;
};

// Column chart with a hover/focus tooltip per bar — same shape as
// media-grids/rating-distribution, generalized to arbitrary tick/value pairs.
export function VerticalBarChart({ items, color = "var(--brand)" }: Props) {
	const max = Math.max(...items.map((i) => i.value), 1);

	return (
		<div className={styles.chart}>
			{items.map((item) => (
				<div className={styles.column} key={item.key}>
					<div
						className={styles.bar_track}
						tabIndex={item.value > 0 ? 0 : undefined}
						aria-label={item.ariaLabel}>
						<div
							className={styles.bar}
							style={{
								height: `${(item.value / max) * 100}%`,
								background: color,
							}}
						/>
						{item.value > 0 && (
							<span className={styles.tooltip} aria-hidden>
								{item.tooltip}
							</span>
						)}
					</div>
					<span className={styles.tick}>{item.tick}</span>
				</div>
			))}
		</div>
	);
}
