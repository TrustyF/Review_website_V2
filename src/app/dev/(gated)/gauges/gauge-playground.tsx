"use client";

import { useState } from "react";
import { CircularGauge } from "@/components/ui/circular-gauge";
import styles from "./gauges-dev.module.sass";

const PRESET_VALUES = [
	0, 15, 50, 75, 100, 137, 250, 349, -15, -50, -75, -100, -180, -260,
];

export function GaugePlayground() {
	const [value, setValue] = useState(37);
	const [max, setMax] = useState(100);
	const [size, setSize] = useState(120);
	const [strokeWidth, setStrokeWidth] = useState(10);
	const [trailOpacity, setTrailOpacity] = useState(0.75);

	return (
		<div className={styles.wrapper}>
			<h1>Circular gauge preview</h1>
			<p>
				Live-tunable gauge, plus a spread of preset values at default settings.
			</p>

			<div className={styles.controls}>
				<div className={styles.control_row}>
					<label htmlFor="value">value</label>
					<input
						id="value"
						type="range"
						min={-2000}
						max={2000}
						value={value}
						onChange={(e) => setValue(Number(e.target.value))}
					/>
					<output>{value}</output>
				</div>
				<div className={styles.control_row}>
					<label htmlFor="max">max</label>
					<input
						id="max"
						type="range"
						min={1}
						max={200}
						value={max}
						onChange={(e) => setMax(Number(e.target.value))}
					/>
					<output>{max}</output>
				</div>
				<div className={styles.control_row}>
					<label htmlFor="size">size</label>
					<input
						id="size"
						type="range"
						min={20}
						max={240}
						value={size}
						onChange={(e) => setSize(Number(e.target.value))}
					/>
					<output>{size}</output>
				</div>
				<div className={styles.control_row}>
					<label htmlFor="strokeWidth">strokeWidth</label>
					<input
						id="strokeWidth"
						type="range"
						min={1}
						max={40}
						value={strokeWidth}
						onChange={(e) => setStrokeWidth(Number(e.target.value))}
					/>
					<output>{strokeWidth}</output>
				</div>
				<div className={styles.control_row}>
					<label htmlFor="trailOpacity">trailOpacity</label>
					<input
						id="trailOpacity"
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={trailOpacity}
						onChange={(e) => setTrailOpacity(Number(e.target.value))}
					/>
					<output>{trailOpacity.toFixed(2)}</output>
				</div>
			</div>

			<div className={styles.preview}>
				<CircularGauge
					value={value}
					max={max}
					size={size}
					strokeWidth={strokeWidth}
					trailOpacity={trailOpacity}
					unit="%"
				/>
			</div>

			<div className={styles.section}>
				<h2>Preset values (max=100, size=64, strokeWidth=8)</h2>
				<div className={styles.grid}>
					{PRESET_VALUES.map((v) => (
						<div
							className={styles.cell}
							key={v}
						>
							<CircularGauge
								value={v}
								size={64}
								strokeWidth={8}
								unit="%"
							/>
							{v}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
