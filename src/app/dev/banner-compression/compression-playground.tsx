"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { compressPreview, getOriginalSize } from "./compression-actions";
import {
	CompressionFormat,
	CompressionResult,
	DenoiseMethod,
} from "./compression-types";
import styles from "./banner-compression-dev.module.sass";

type BannerOption = {
	id: number;
	title: string;
	sourceUrl: string;
};

type Props = {
	banners: BannerOption[];
	// What resolveBanner actually ships today — the fixed middle pane compares
	// against this regardless of whatever the custom controls are set to.
	// Passed down from the server component rather than importing
	// BANNER_MAX_WIDTH/BANNER_WEBP_QUALITY here directly: poster-resolver.ts
	// pulls in fs/promises and sharp, and this is a "use client" module — any
	// value imported from it drags the whole (server-only) module into the
	// browser bundle, which fails outright on fs/promises having no browser
	// equivalent.
	productionSettings: {
		format: CompressionFormat;
		quality: number;
		width: number;
	};
};

const FORMATS: CompressionFormat[] = ["webp", "avif", "jpeg"];
const DENOISE_METHODS: DenoiseMethod[] = ["median", "blur"];
// Range/step/off-value differ per method: median takes an odd kernel size in
// px (1 = off, sharp's own no-op case); blur takes a sigma (0 = off, skipped
// entirely rather than passed to sharp, which requires sigma >= 0.3).
const DENOISE_RANGE: Record<
	DenoiseMethod,
	{ min: number; max: number; step: number; off: number }
> = {
	median: { min: 1, max: 9, step: 2, off: 1 },
	blur: { min: 0, max: 10, step: 0.5, off: 0 },
};

function formatBytes(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function CompressionPlayground({ banners, productionSettings }: Props) {
	const [selectedId, setSelectedId] = useState<number | "custom">(
		banners[0]?.id ?? "custom",
	);
	const [customUrl, setCustomUrl] = useState("");
	const [format, setFormat] = useState<CompressionFormat>(
		productionSettings.format,
	);
	const [quality, setQuality] = useState(productionSettings.quality);
	const [width, setWidth] = useState(productionSettings.width);
	const [denoiseMethod, setDenoiseMethod] = useState<DenoiseMethod>("median");
	const [denoiseAmount, setDenoiseAmount] = useState(DENOISE_RANGE.median.off);
	// A CSS overlay applied only to the rendered <img>, not the compressed
	// file itself — see .grain_overlay below. 0 = off.
	const [grainOpacity, setGrainOpacity] = useState(0);

	const sourceUrl =
		selectedId === "custom"
			? customUrl.trim()
			: (banners.find((b) => b.id === selectedId)?.sourceUrl ?? "");

	const [originalSize, setOriginalSize] = useState<number | null>(null);
	const [baseline, setBaseline] = useState<CompressionResult | null>(null);
	const [result, setResult] = useState<CompressionResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Guards against a slow request (avif in particular can take seconds)
	// resolving after a newer one and clobbering it with a stale result —
	// only the response matching the latest-fired request is ever applied.
	const requestIdRef = useRef(0);

	// Cleared the moment the source itself changes, during render rather than
	// an effect — an effect that calls setState synchronously in its body
	// (not from an async callback) trips this repo's react-compiler lint
	// rule, and would briefly show the previous image's stale numbers anyway.
	const [prevSourceUrl, setPrevSourceUrl] = useState(sourceUrl);
	if (sourceUrl !== prevSourceUrl) {
		setPrevSourceUrl(sourceUrl);
		setOriginalSize(null);
		setBaseline(null);
		setResult(null);
		setError(null);
	}

	// Refetched only when the source image itself changes, not on every
	// slider tweak — the original's size and the production baseline don't
	// depend on the custom controls at all.
	useEffect(() => {
		if (!sourceUrl) return;
		const requestId = ++requestIdRef.current;
		getOriginalSize(sourceUrl)
			.then((size) => {
				if (requestIdRef.current === requestId) setOriginalSize(size);
			})
			.catch(() => {
				if (requestIdRef.current === requestId) {
					setError("Couldn't load that image.");
				}
			});
		compressPreview(sourceUrl, productionSettings)
			.then((r) => {
				if (requestIdRef.current === requestId) setBaseline(r);
			})
			.catch(() => {});
	}, [sourceUrl, productionSettings]);

	// Debounced re-compress whenever the source or any control changes —
	// dragging a slider shouldn't fire a request per pixel.
	useEffect(() => {
		if (!sourceUrl) return;
		const handle = setTimeout(() => {
			const requestId = ++requestIdRef.current;
			startTransition(() => {
				compressPreview(sourceUrl, {
					format,
					quality,
					width,
					denoiseMethod,
					denoiseAmount,
				})
					.then((r) => {
						if (requestIdRef.current === requestId) setResult(r);
					})
					.catch(() => {
						if (requestIdRef.current === requestId) {
							setError("Compression failed.");
						}
					});
			});
		}, 300);
		return () => clearTimeout(handle);
	}, [sourceUrl, format, quality, width, denoiseMethod, denoiseAmount]);

	return (
		<div className={styles.wrapper}>
			<h1>Banner compression playground</h1>
			<p>
				Try format/quality/width combinations against a real banner source —
				nothing here writes to the cache or the DB, every result is just a data
				URL held in memory. Every preview below (including the original) is a
				plain, unproxied {"<img>"}, not next/image — a dev-only tool never
				shipped to users doesn&apos;t need the allowlist/optimization next/image
				is for.
			</p>

			<div className={styles.controls}>
				<div className={styles.control_row}>
					<label htmlFor="banner">banner</label>
					<select
						id="banner"
						value={String(selectedId)}
						onChange={(e) =>
							setSelectedId(
								e.target.value === "custom" ? "custom" : Number(e.target.value),
							)
						}>
						{banners.map((b) => (
							<option key={b.id} value={b.id}>
								{b.title}
							</option>
						))}
						<option value="custom">Custom URL…</option>
					</select>
				</div>

				{selectedId === "custom" && (
					<div className={styles.control_row}>
						<label htmlFor="customUrl">source url</label>
						<input
							id="customUrl"
							type="text"
							placeholder="https://…"
							value={customUrl}
							onChange={(e) => setCustomUrl(e.target.value)}
						/>
					</div>
				)}

				<div className={styles.control_row}>
					<label htmlFor="format">format</label>
					<select
						id="format"
						value={format}
						onChange={(e) => setFormat(e.target.value as CompressionFormat)}>
						{FORMATS.map((f) => (
							<option key={f} value={f}>
								{f}
							</option>
						))}
					</select>
				</div>

				<div className={styles.control_row}>
					<label htmlFor="quality">quality</label>
					<input
						id="quality"
						type="range"
						min={1}
						max={100}
						value={quality}
						onChange={(e) => setQuality(Number(e.target.value))}
					/>
					<output>{quality}</output>
				</div>

				<div className={styles.control_row}>
					<label htmlFor="width">width</label>
					<input
						id="width"
						type="range"
						min={320}
						max={1920}
						step={40}
						value={width}
						onChange={(e) => setWidth(Number(e.target.value))}
					/>
					<output>{width}px</output>
				</div>

				<div className={styles.control_row}>
					<label htmlFor="denoiseMethod">denoise</label>
					<select
						id="denoiseMethod"
						value={denoiseMethod}
						onChange={(e) => {
							const method = e.target.value as DenoiseMethod;
							setDenoiseMethod(method);
							setDenoiseAmount(DENOISE_RANGE[method].off);
						}}>
						{DENOISE_METHODS.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
					<input
						id="denoiseAmount"
						type="range"
						min={DENOISE_RANGE[denoiseMethod].min}
						max={DENOISE_RANGE[denoiseMethod].max}
						step={DENOISE_RANGE[denoiseMethod].step}
						value={denoiseAmount}
						onChange={(e) => setDenoiseAmount(Number(e.target.value))}
					/>
					<output>
						{denoiseAmount === DENOISE_RANGE[denoiseMethod].off
							? "off"
							: denoiseMethod === "median"
								? `${denoiseAmount}px`
								: denoiseAmount}
					</output>
				</div>

				<div className={styles.control_row}>
					<label htmlFor="grain">grain overlay</label>
					<input
						id="grain"
						type="range"
						min={0}
						max={0.3}
						step={0.02}
						value={grainOpacity}
						onChange={(e) => setGrainOpacity(Number(e.target.value))}
					/>
					<output>
						{grainOpacity === 0 ? "off" : grainOpacity.toFixed(2)}
					</output>
				</div>
				<p className={styles.hint}>
					Grain overlay is a CSS effect on top of the {"<img>"} below, not part
					of the compressed file — free at any strength, unlike baking noise
					into the pixels before encoding would be.
				</p>

				<button
					type="button"
					onClick={() => {
						setFormat(productionSettings.format);
						setQuality(productionSettings.quality);
						setWidth(productionSettings.width);
						setDenoiseMethod("median");
						setDenoiseAmount(DENOISE_RANGE.median.off);
						setGrainOpacity(0);
					}}>
					Reset to production defaults
				</button>
			</div>

			{error && <p className={styles.error}>{error}</p>}

			{sourceUrl && (
				<div className={styles.comparison}>
					<div className={styles.pane}>
						<h2>Original</h2>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={sourceUrl} alt="" className={styles.image} />
						<p>{originalSize !== null ? formatBytes(originalSize) : "…"}</p>
					</div>

					{/*<div className={styles.pane}>*/}
					{/*	<h2>*/}
					{/*		Production (webp, q{productionSettings.quality},{" "}*/}
					{/*		{productionSettings.width}px)*/}
					{/*	</h2>*/}
					{/*	{baseline && (*/}
					{/*		// eslint-disable-next-line @next/next/no-img-element*/}
					{/*		<img src={baseline.dataUrl} alt="" className={styles.image} />*/}
					{/*	)}*/}
					{/*	<p>{baseline ? formatBytes(baseline.sizeBytes) : "…"}</p>*/}
					{/*</div>*/}

					<div className={styles.pane}>
						{/*<h2>*/}
						{/*	Custom ({format}, q{quality}, {width}px)*/}
						{/*	{isPending && " — compressing…"}*/}
						{/*</h2>*/}
						{result && (
							<div className={styles.grain_wrapper}>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={result.dataUrl} alt="" className={styles.image} />
								{grainOpacity > 0 && (
									<div
										className={styles.grain_overlay}
										style={{ opacity: grainOpacity }}
									/>
								)}
							</div>
						)}
						<p>
							{result ? formatBytes(result.sizeBytes) : "…"}
							{result && originalSize !== null && originalSize > 0 && (
								<span className={styles.reduction}>
									{" "}
									({Math.round((1 - result.sizeBytes / originalSize) * 100)}%
									smaller than original)
								</span>
							)}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
