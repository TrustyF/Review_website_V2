"use client";
import { useEffect, useState } from "react";
import { Clickable } from "@/components/ui/clickable";
import { MediaBrowser } from "@/components/media/media-browser/media-browser";
import { MediaBrowserSearchResult } from "@/components/media/media-browser/media-browser-actions";
import { getImageInfo, getPosterOption, ImageInfo, PosterOption } from "./poster-scaling-actions";
import styles from "./poster-scaling-playground.module.sass";

// Real on-screen poster widths in production (see lazy-media-grid.module.sass's
// $mini-card-min-width/-mobile) — the slider defaults to the desktop mini-card size.
const DEFAULT_WIDTH = 120;
const SIZE_PRESETS = [
	{ label: "Mobile mini card", width: 100 },
	{ label: "Mini card", width: DEFAULT_WIDTH },
	{ label: "Detail page", width: 220 },
];

function formatBytes(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function VariantBox({
	label,
	hint,
	url,
	info,
	targetWidth,
	ratio,
}: {
	label: string;
	hint: string;
	url: string;
	info: ImageInfo | null | "error";
	targetWidth: number;
	ratio: string;
}) {
	return (
		<div className={styles.variant}>
			<div className={styles.variant_label}>{label}</div>
			<div
				className={styles.frame}
				style={{ width: targetWidth, aspectRatio: ratio }}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={url} alt="" className={styles.image} />
			</div>
			<p className={styles.hint}>{hint}</p>
			<p className={styles.stats}>
				{info === "error"
					? "Failed to load"
					: info
						? `${info.width}×${info.height} · ${formatBytes(info.sizeBytes)}`
						: "…"}
			</p>
		</div>
	);
}

export function PosterScalingPlayground({
	initialPoster,
}: {
	initialPoster: PosterOption | null;
}) {
	const [poster, setPoster] = useState(initialPoster);
	const [pickerError, setPickerError] = useState<string | null>(null);
	const [isBrowserOpen, setIsBrowserOpen] = useState(false);
	const [targetWidth, setTargetWidth] = useState(DEFAULT_WIDTH);
	const [fullInfo, setFullInfo] = useState<ImageInfo | null | "error">(null);
	const [thumbInfo, setThumbInfo] = useState<ImageInfo | null | "error">(null);

	// Cleared during render (not the effect below) so a stale byte count never flashes
	// while the new selection's fetch is in flight — same pattern as CompressionPlayground.
	const [prevPosterId, setPrevPosterId] = useState(poster?.id);
	if (poster?.id !== prevPosterId) {
		setPrevPosterId(poster?.id);
		setFullInfo(null);
		setThumbInfo(null);
	}

	// Byte size/dimensions depend only on which source URL loads, not on the on-screen
	// width slider — fetched once per selection, shared by both boxes and the summary.
	useEffect(() => {
		if (!poster) return;
		getImageInfo(poster.fullUrl)
			.then(setFullInfo)
			.catch(() => setFullInfo("error"));
		getImageInfo(poster.thumbUrl)
			.then(setThumbInfo)
			.catch(() => setThumbInfo("error"));
	}, [poster]);

	async function handlePick(result: MediaBrowserSearchResult) {
		setIsBrowserOpen(false);
		const option = await getPosterOption(result.id);
		if (!option) {
			setPickerError(`"${result.title}" has no source poster to compare.`);
			return;
		}
		setPickerError(null);
		setPoster(option);
	}

	const savingsPercent =
		fullInfo && fullInfo !== "error" && thumbInfo && thumbInfo !== "error" && fullInfo.sizeBytes > 0
			? Math.round((1 - thumbInfo.sizeBytes / fullInfo.sizeBytes) * 100)
			: null;

	return (
		<div className={styles.wrapper}>
			<h1>Poster scale-down playground</h1>
			<p className={styles.hint}>
				Compares loading the same source every mini-card uses today (full size,
				downscaled by CSS to fit the card) against requesting the smaller tier
				each source actually offers. next.config.js sets{" "}
				<code>images.unoptimized: true</code> for this app, so next/image can&apos;t
				resize on the fly here — a smaller render only happens if a smaller source
				is requested directly, which is what the second box below does.
			</p>

			<div className={styles.controls}>
				<div className={styles.control_row}>
					<label>poster</label>
					<Clickable
						className={styles.picker_button}
						onClick={() => setIsBrowserOpen(true)}>
						{poster ? poster.title : "Pick a poster…"}
					</Clickable>
					{pickerError && <p className={styles.error}>{pickerError}</p>}
				</div>

				<div className={styles.control_row}>
					<div className={styles.control_head}>
						<label htmlFor="width">on-screen width</label>
						<output>{targetWidth}px</output>
					</div>
					<input
						id="width"
						type="range"
						min={40}
						max={300}
						step={10}
						value={targetWidth}
						onChange={(e) => setTargetWidth(Number(e.target.value))}
					/>
					<div className={styles.presets}>
						{SIZE_PRESETS.map((preset) => (
							<button
								key={preset.label}
								type="button"
								onClick={() => setTargetWidth(preset.width)}>
								{preset.label} ({preset.width}px)
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Always mounted (visibility toggled via isOpen), same as AddMediaToList — preserves search state across opens. */}
			<MediaBrowser isOpen={isBrowserOpen} onSelect={handlePick} onClose={() => setIsBrowserOpen(false)} />

			{poster && (
				<>
					<div className={styles.comparison}>
						<VariantBox
							label="Full-size source, CSS-downscaled"
							hint="What MediaPoster renders today, at any card size."
							url={poster.fullUrl}
							info={fullInfo}
							targetWidth={targetWidth}
							ratio={poster.ratio}
						/>
						<VariantBox
							label="Origin's smaller tier, requested directly"
							hint="Same origin, but the size bucket closest to a mini-card."
							url={poster.thumbUrl}
							info={thumbInfo}
							targetWidth={targetWidth}
							ratio={poster.ratio}
						/>
					</div>

					{savingsPercent !== null && (
						<p className={styles.summary}>
							The smaller tier is <strong>{savingsPercent}%</strong> less data,
							independent of how small the card renders it — the full-size source
							transfers the same bytes whether it&apos;s shown at 300px or 40px.
						</p>
					)}
				</>
			)}
		</div>
	);
}
