import { Link } from "@/components/ui/link";
import styles from "./horizontal-bar-list.module.sass";

export type HorizontalBarItem = {
	key: string;
	label: string;
	value: number;
	// CSS color value (e.g. "var(--chart-1)") — per-item for a categorical
	// breakdown, or the same value on every item for a single-hue ranking.
	color: string;
	prefix?: React.ReactNode;
	// Makes the row a link (e.g. to that country's/person's own page) — plain otherwise.
	href?: string;
};

type Props = {
	items: HorizontalBarItem[];
	valueFormatter?: (value: number) => string;
	// Fixed scale endpoints (e.g. a rating's editable range) instead of
	// auto-fitting to this list's own min/max — omit for count-style lists.
	scaleMin?: number;
	scaleMax?: number;
};

// Label-left, bar-right ranking — used for the media-type breakdown (colored
// per item) and single-hue rankings (top genres, top countries) alike.
export function HorizontalBarList({
	items,
	valueFormatter,
	scaleMin,
	scaleMax,
}: Props) {
	const min = scaleMin ?? 0;
	const max = scaleMax ?? Math.max(...items.map((i) => i.value), 1);

	return (
		<ul className={styles.list}>
			{items.map((item) => {
				const content = (
					<>
						<span className={styles.label}>
							{item.prefix}
							{item.label}
						</span>
						<span className={styles.track}>
							<span
								className={styles.bar}
								style={{
									width: `${Math.min(100, Math.max(0, ((item.value - min) / (max - min)) * 100))}%`,
									background: item.color,
								}}
							/>
						</span>
						<span className={styles.value}>
							{valueFormatter ? valueFormatter(item.value) : item.value}
						</span>
					</>
				);
				return (
					<li key={item.key}>
						{item.href ? (
							<Link
								href={item.href}
								className={`${styles.row} ${styles.row_link}`}>
								{content}
							</Link>
						) : (
							<div className={styles.row}>{content}</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}
