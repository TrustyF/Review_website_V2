"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { compressPreview, getOriginalSize } from "./compression-actions";
import {
	CompressionFormat,
	CompressionResult,
	DenoiseMethod,
} from "./compression-types";
import styles from "./banner-compression-dev.module.sass";

type AssetOption = {
	id: number;
	title: string;
	sourceUrl: string;
	// Posters only — see poster-ratio.ts. Undefined for banners, which don't
	// have an equivalent small on-screen size (always full column width).
	ratio?: string;
};

// The actual CSS width each real usage renders a poster at — see
// media-card-shell.module.sass's .poster (grid) and media-detail.module.
// sass's .poster (detail page). Compression artifacts that are obvious
// blown up in the big slice-compare view below can be completely invisible
// at these sizes, which is the only place that actually matters for judging
// whether a setting is fine to ship.
const POSTER_PRACTICAL_SIZES = [
	{ label: "Grid card", width: 130 },
	{ label: "Detail page", width: 220 },
];

type AssetType = "banner" | "poster";

type ProductionSettings = {
	format: CompressionFormat;
	quality: number;
	width: number;
	grainOpacity: number;
};

type Props = {
	banners: AssetOption[];
	posters: AssetOption[];
	// What resolveBanner/resolvePoster actually ship today — "Reset to
	// production defaults" below re-baselines every control against
	// whichever of these matches the current asset-type selection. Passed
	// down from the server component rather than importing the BANNER_*/
	// POSTER_* constants here directly: poster-resolver.ts pulls in
	// fs/promises and sharp, and this is a "use client" module — any value
	// imported from it drags the whole (server-only) module into the
	// browser bundle, which fails outright on fs/promises having no browser
	// equivalent.
	bannerSettings: ProductionSettings;
	posterSettings: ProductionSettings;
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

export function CompressionPlayground({
	banners,
	posters,
	bannerSettings,
	posterSettings,
}: Props) {
	const [assetType, setAssetType] = useState<AssetType>("banner");
	const options = assetType === "banner" ? banners : posters;
	const productionSettings =
		assetType === "banner" ? bannerSettings : posterSettings;

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
	const [grainOpacity, setGrainOpacity] = useState(
		productionSettings.grainOpacity,
	);
	// Drag position of the before/after divider, in percent from the left —
	// 0 shows all original, 100 shows all compressed. Read directly by the
	// clip-path below rather than being recomputed from pointer state on
	// every render.
	const [comparePercent, setComparePercent] = useState(50);
	const compareWrapperRef = useRef<HTMLDivElement>(null);

	// Every control jumps to the new asset type's own production baseline —
	// the same values "Reset to production defaults" below sets — rather
	// than, say, carrying avif/60 over as a starting point for a poster,
	// which was never encoded that way in production.
	function selectAssetType(type: AssetType) {
		const settings = type === "banner" ? bannerSettings : posterSettings;
		const nextOptions = type === "banner" ? banners : posters;
		setAssetType(type);
		setSelectedId(nextOptions[0]?.id ?? "custom");
		setFormat(settings.format);
		setQuality(settings.quality);
		setWidth(settings.width);
		setDenoiseMethod("median");
		setDenoiseAmount(DENOISE_RANGE.median.off);
		setGrainOpacity(settings.grainOpacity);
	}

	function updateComparePercent(clientX: number) {
		const rect = compareWrapperRef.current?.getBoundingClientRect();
		if (!rect || rect.width === 0) return;
		const pct = ((clientX - rect.left) / rect.width) * 100;
		setComparePercent(Math.min(100, Math.max(0, pct)));
	}

	const selectedOption =
		selectedId === "custom"
			? undefined
			: options.find((o) => o.id === selectedId);
	const sourceUrl =
		selectedId === "custom"
			? customUrl.trim()
			: (selectedOption?.sourceUrl ?? "");
	// Falls back to 2/3 for a custom URL, which has no known media type to
	// look a real ratio up from — same default posterRatioFor's own caller
	// (MediaPoster) uses.
	const posterRatio = selectedOption?.ratio ?? "2/3";

	const [originalSize, setOriginalSize] = useState<number | null>(null);
	const [baseline, setBaseline] = useState<CompressionResult | null>(null);
	const [result, setResult] = useState<CompressionResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Guards against a slow request (avif in particular can take seconds)
	// resolving after a newer one and clobbering it with a stale result —
	// only the response matching the latest-fired request is ever applied.
	// Two separate counters because the two effects below are independent
	// request streams that both key off sourceUrl: sharing one counter meant
	// the debounced custom-compress effect's tick (300ms after every source
	// change) invalidated the still-in-flight original/baseline requestId
	// almost every time, before that slower fetch had a chance to resolve —
	// originalSize stayed null forever and the "% smaller" comparison never
	// showed.
	const baselineRequestIdRef = useRef(0);
	const resultRequestIdRef = useRef(0);

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
		setComparePercent(50);
	}

	// Refetched only when the source image itself changes, not on every
	// slider tweak — the original's size and the production baseline don't
	// depend on the custom controls at all.
	useEffect(() => {
		if (!sourceUrl) return;
		const requestId = ++baselineRequestIdRef.current;
		getOriginalSize(sourceUrl)
			.then((size) => {
				if (baselineRequestIdRef.current === requestId) setOriginalSize(size);
			})
			.catch(() => {
				if (baselineRequestIdRef.current === requestId) {
					setError("Couldn't load that image.");
				}
			});
		compressPreview(sourceUrl, productionSettings)
			.then((r) => {
				if (baselineRequestIdRef.current === requestId) setBaseline(r);
			})
			.catch(() => {});
	}, [sourceUrl, productionSettings]);

	// Debounced re-compress whenever the source or any control changes —
	// dragging a slider shouldn't fire a request per pixel.
	useEffect(() => {
		if (!sourceUrl) return;
		const handle = setTimeout(() => {
			const requestId = ++resultRequestIdRef.current;
			startTransition(() => {
				compressPreview(sourceUrl, {
					format,
					quality,
					width,
					denoiseMethod,
					denoiseAmount,
				})
					.then((r) => {
						if (resultRequestIdRef.current === requestId) setResult(r);
					})
					.catch(() => {
						if (resultRequestIdRef.current === requestId) {
							setError("Compression failed.");
						}
					});
			});
		}, 300);
		return () => clearTimeout(handle);
	}, [sourceUrl, format, quality, width, denoiseMethod, denoiseAmount]);

	return (
		<div className={styles.wrapper}>
			<h1>Image compression playground</h1>

			<div className={styles.controls}>
				<div className={styles.control_row}>
					<label htmlFor="assetType">asset</label>
					<select
						id="assetType"
						value={assetType}
						onChange={(e) => selectAssetType(e.target.value as AssetType)}>
						<option value="banner">Banner</option>
						<option value="poster">Poster</option>
					</select>
				</div>

				<div className={styles.control_row}>
					<label htmlFor="source">{assetType}</label>
					<select
						id="source"
						value={String(selectedId)}
						onChange={(e) =>
							setSelectedId(
								e.target.value === "custom" ? "custom" : Number(e.target.value),
							)
						}>
						{options.map((o) => (
							<option key={o.id} value={o.id}>
								{o.title}
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
					<div className={styles.control_head}>
						<label htmlFor="quality">quality</label>
						<output>{quality}</output>
					</div>
					<input
						id="quality"
						type="range"
						min={1}
						max={100}
						value={quality}
						onChange={(e) => setQuality(Number(e.target.value))}
					/>
				</div>

				<div className={styles.control_row}>
					<div className={styles.control_head}>
						<label htmlFor="width">width</label>
						<output>{width}px</output>
					</div>
					<input
						id="width"
						type="range"
						min={320}
						max={1920}
						step={40}
						value={width}
						onChange={(e) => setWidth(Number(e.target.value))}
					/>
				</div>
				{assetType === "poster" && (
					<p className={styles.hint}>
						resolvePoster never resizes — this only affects the preview here,
						not what production would actually cache.
					</p>
				)}

				<div className={styles.control_row}>
					<div className={styles.control_head}>
						<label htmlFor="denoiseMethod">denoise</label>
						<output>
							{denoiseAmount === DENOISE_RANGE[denoiseMethod].off
								? "off"
								: denoiseMethod === "median"
									? `${denoiseAmount}px`
									: denoiseAmount}
						</output>
					</div>
					<div className={styles.control_body}>
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
					</div>
				</div>

				<div className={styles.control_row}>
					<div className={styles.control_head}>
						<label htmlFor="grain">grain overlay</label>
						<output>
							{grainOpacity === 0 ? "off" : grainOpacity.toFixed(2)}
						</output>
					</div>
					<input
						id="grain"
						type="range"
						min={0}
						max={0.3}
						step={0.02}
						value={grainOpacity}
						onChange={(e) => setGrainOpacity(Number(e.target.value))}
					/>
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
						setGrainOpacity(productionSettings.grainOpacity);
					}}>
					Reset to production defaults
				</button>
			</div>

			{error && <p className={styles.error}>{error}</p>}

			{sourceUrl && (
				<div className={styles.comparison}>
					<div
						ref={compareWrapperRef}
						className={styles.compare_wrapper}
						onPointerDown={(e) => {
							e.currentTarget.setPointerCapture(e.pointerId);
							updateComparePercent(e.clientX);
						}}
						onPointerMove={(e) => {
							if (e.buttons !== 1) return;
							updateComparePercent(e.clientX);
						}}>
						{/* Original — the base layer, sized normally. It alone determines
						    the box's height; the compressed layer below just fills it. */}
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={sourceUrl} alt="" className={styles.compare_image} />

						{result && (
							// clip-path (not a width on this box) does the reveal, so the
							// compressed <img> inside is never resized/squashed as the
							// divider moves — only how much of its full-size box shows.
							<div
								className={styles.compare_overlay}
								style={{ clipPath: `inset(0 ${100 - comparePercent}% 0 0)` }}>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={result.dataUrl}
									alt=""
									className={styles.compare_image}
								/>
								{grainOpacity > 0 && (
									<div
										className={styles.grain_overlay}
										style={{ opacity: grainOpacity }}
									/>
								)}
							</div>
						)}

						{result && (
							<div
								className={styles.compare_handle}
								style={{ left: `${comparePercent}%` }}
							/>
						)}

						<div className={styles.compare_label_left}>Compressed</div>
						<div className={styles.compare_label_right}>Original</div>
					</div>

					<div className={styles.control_row}>
						<button
							type="button"
							disabled={!result}
							onClick={() => setComparePercent((p) => (p > 50 ? 0 : 100))}>
							Flip
						</button>
						<p>
							Original {originalSize !== null ? formatBytes(originalSize) : "…"}
							{" · "}
							Compressed {result ? formatBytes(result.sizeBytes) : "…"}
							{result && originalSize !== null && originalSize > 0 && (
								<span className={styles.reduction}>
									{" "}
									({Math.round((1 - result.sizeBytes / originalSize) * 100)}%
									smaller than original)
								</span>
							)}
						</p>
					</div>

					{assetType === "poster" && result && (
						<div className={styles.practical_row}>
							{POSTER_PRACTICAL_SIZES.map(({ label, width: sizeWidth }) => (
								<div key={label} className={styles.practical_item}>
									<span className={styles.hint}>
										{label} ({sizeWidth}px)
									</span>
									<div
										className={styles.practical_frame}
										style={{
											width: sizeWidth,
											aspectRatio: posterRatio,
										}}>
										{/* Same object-fit: fill treatment as MediaPoster's own
										    .poster — a straight stretch to the frame, not a crop,
										    so this matches what production actually renders. */}
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={result.dataUrl}
											alt=""
											className={styles.practical_image}
										/>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
