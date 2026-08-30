"use client";

import { useState } from "react";
import styles from "./responsive-preview-dev.module.sass";

// Real iframes at real pixel widths, not a scaled-down mockup — the whole
// point is to see the actual rendering (fonts, scrollbars, media queries)
// at each size, side by side, instead of resizing one window three times.
// Same-origin src (relative path) so this works regardless of which port
// the dev server actually landed on.
const DEFAULT_WIDTHS = [375, 800, 1400];

export function ResponsivePreview() {
	const [path, setPath] = useState("/");
	const [widths, setWidths] = useState<number[]>(DEFAULT_WIDTHS);
	// Bumped to force every iframe to remount — editing path already
	// reloads them via a src change, but this covers "I changed some code,
	// reload without navigating anywhere."
	const [reloadKey, setReloadKey] = useState(0);

	function setWidth(index: number, value: number) {
		setWidths((prev) => prev.map((w, i) => (i === index ? value : w)));
	}

	return (
		<div className={styles.wrapper}>
			<h1>Responsive preview</h1>
			<p>
				Same page loaded at three widths at once — edit the path or a
				pane&apos;s own width and it reloads that pane.
			</p>

			<div className={styles.controls}>
				<div className={styles.control_row}>
					<label htmlFor="path">path</label>
					<input
						id="path"
						type="text"
						value={path}
						onChange={(e) => setPath(e.target.value)}
						placeholder="/movies"
					/>
				</div>
				<button
					type="button"
					className={styles.reload_button}
					onClick={() => setReloadKey((k) => k + 1)}>
					Reload all
				</button>
			</div>

			<div className={styles.panes}>
				{widths.map((width, i) => (
					<div className={styles.pane} key={i}>
						<div className={styles.pane_label}>
							<input
								type="number"
								className={styles.width_input}
								value={width}
								min={200}
								max={3000}
								onChange={(e) => setWidth(i, Number(e.target.value))}
							/>
							px
						</div>
						<iframe
							key={`${i}-${reloadKey}`}
							src={path}
							className={styles.pane_frame}
							style={{ width }}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
