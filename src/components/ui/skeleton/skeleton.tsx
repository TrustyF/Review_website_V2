import { CSSProperties } from "react";
import styles from "./skeleton.module.sass";

type SkeletonBarProps = {
	width: string;
	height: string;
	className?: string | undefined;
};

// A single pulsing placeholder rect — a page's own loading.tsx composes a
// handful of these (plus SkeletonCardGrid below) to sketch its real layout
// before any data has loaded.
export function SkeletonBar({ width, height, className }: SkeletonBarProps) {
	return (
		<div
			className={className ? `${styles.bar} ${className}` : styles.bar}
			style={{ width, height }}
		/>
	);
}

type SkeletonCardGridProps = {
	count: number;
	// CSS var overrides — same shape lazy-media-grid.module.sass's own grid
	// uses ($mini-card-min-width), kept as plain strings here rather than
	// importing that sass variable so this stays framework-agnostic.
	minWidth?: string | undefined;
	aspectRatio?: string | undefined;
	gap?: string | undefined;
	className?: string | undefined;
};

// A grid of pulsing card-shaped placeholders — stands in for LazyMediaGrid/
// MediaFilterGrid while the real query is still in flight.
export function SkeletonCardGrid({
	count,
	minWidth,
	aspectRatio,
	gap,
	className,
}: SkeletonCardGridProps) {
	const style = {
		"--skeleton-min-width": minWidth,
		"--skeleton-aspect-ratio": aspectRatio,
		"--skeleton-gap": gap,
	} as CSSProperties;
	return (
		<div
			className={className ? `${styles.grid} ${className}` : styles.grid}
			style={style}>
			{Array.from({ length: count }, (_, i) => (
				<div key={i} className={styles.card} />
			))}
		</div>
	);
}
