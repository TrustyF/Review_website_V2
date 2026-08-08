"use client";
import styles from "./dual-range-slider.module.sass";

type Props = {
	min: number;
	max: number;
	step: number;
	value: [number, number];
	onChange: (value: [number, number]) => void;
	formatValue?: (value: number) => string;
};

// Two overlapping native <input type="range"> elements sharing one track —
// each renders its own thumb only (the track itself is hidden via CSS, see
// dual-range-slider.module.sass), so both stay independently draggable
// without a pointer-tracking implementation of our own. Whichever handle is
// dragged past the other pushes it along rather than crossing it, so lo/hi
// can't invert.
export function DualRangeSlider({
	min,
	max,
	step,
	value,
	onChange,
	formatValue,
}: Props) {
	const [lo, hi] = value;
	const format = formatValue ?? ((v: number) => String(v));

	const loPercent = ((lo - min) / (max - min)) * 100;
	const hiPercent = ((hi - min) / (max - min)) * 100;

	return (
		<div className={styles.wrapper}>
			<div className={styles.value_row}>
				<span>{format(lo)}</span>
				<span>{format(hi)}</span>
			</div>
			<div className={styles.track_container}>
				<div className={styles.track} />
				<div
					className={styles.track_fill}
					style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
				/>
				<input
					type="range"
					className={styles.thumb}
					min={min}
					max={max}
					step={step}
					value={lo}
					onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
				/>
				<input
					type="range"
					className={styles.thumb}
					min={min}
					max={max}
					step={step}
					value={hi}
					onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
				/>
			</div>
		</div>
	);
}
