"use client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import Cropper, { Area, MediaSize, Point } from "react-easy-crop";
import ReactCrop, {
	centerCrop,
	makeAspectCrop,
	type PercentCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
	CROP_SHAPES,
	CropShapeId,
	formatBytes,
	HEAVY_IMAGE_BYTES,
	MAX_OUTPUT_WIDTH,
	MIN_OUTPUT_WIDTH,
} from "./crop-shapes";
import { fetchImportedImage, saveCroppedImageAction } from "./crop-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { AssetBrowser } from "@/components/media/asset-browser/asset-browser";
import styles from "./image-crop-dev.module.sass";

const DEFAULT_SHAPE: CropShapeId = "freeform";

// Freeform's starting crop: the whole image.
const FULL_CROP: PercentCrop = {
	unit: "%",
	x: 0,
	y: 0,
	width: 100,
	height: 100,
};

// Width of the result-preview panel; height follows from the shape's ratio.
const PREVIEW_SIZE = 160;

// How much smaller the avatar "safe zone" guide is than the outer crop circle.
// 0.86 leaves a 7%-of-diameter margin; visual guide only, doesn't affect save.
const AVATAR_SAFE_MARGIN_RATIO = 0.86;

// Ad hoc crop-and-save tool: pick a file/shape, drag/zoom, save, copy the result path.
// Admin- not dev-gated since it's for production use (see crop-actions.ts's own note).
export function ImageCropTool() {
	const isAdmin = useIsAdmin();
	const cropperRef = useRef<InstanceType<typeof Cropper>>(null);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [shapeId, setShapeId] = useState<CropShapeId>(DEFAULT_SHAPE);
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	// Mirrors the library's own computed crop rect size, so the avatar
	// safe-zone guide below can be sized to match it.
	const [cropSize, setCropSize] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	// Natural pixel dimensions of the loaded image; together with croppedAreaPixels
	// this is what the preview panel needs to reproduce the server's extract() rect via CSS.
	const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultPath, setResultPath] = useState<string | null>(null);
	const [resultSize, setResultSize] = useState<number | null>(null);
	const [copied, setCopied] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [isImporting, setIsImporting] = useState(false);
	const [isBrowserOpen, setIsBrowserOpen] = useState(false);
	const [isImportingAsset, setIsImportingAsset] = useState(false);
	// Freeform uses react-image-crop instead (drag edges/corners); react-easy-crop only pans/zooms a fixed-ratio box.
	// Percent-based so it survives the displayed image resizing.
	const [freeCrop, setFreeCrop] = useState<PercentCrop>(FULL_CROP);
	// Optional W:H lock for freeform; null = unlocked.
	const [freeformAspect, setFreeformAspect] = useState<{
		w: string;
		h: string;
	} | null>(null);
	// Optional resize step: exact output width, overriding the shape's default size.
	const [resizeEnabled, setResizeEnabled] = useState(false);
	const [outputWidth, setOutputWidth] = useState("");

	useEffect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	if (!isAdmin) {
		return <div className={styles.wrapper}>Admin access required.</div>;
	}

	const shapeRatio = CROP_SHAPES[shapeId].ratio;
	const lockedAspect = parseAspect(freeformAspect);

	// What gets saved, in natural pixels: freeform derives it from the percent crop, fixed shapes get it from Cropper.
	const cropArea: Area | null =
		shapeRatio === null
			? mediaSize && {
					x: (freeCrop.x / 100) * mediaSize.naturalWidth,
					y: (freeCrop.y / 100) * mediaSize.naturalHeight,
					width: (freeCrop.width / 100) * mediaSize.naturalWidth,
					height: (freeCrop.height / 100) * mediaSize.naturalHeight,
				}
			: croppedAreaPixels;
	const cropRatio = cropArea
		? cropArea.width / cropArea.height
		: (shapeRatio ?? 1);

	const parsedOutputWidth = Number(outputWidth);
	const outputWidthValid =
		Number.isInteger(parsedOutputWidth) &&
		parsedOutputWidth >= MIN_OUTPUT_WIDTH &&
		parsedOutputWidth <= MAX_OUTPUT_WIDTH;

	// Shared by the file picker and URL import so both reset exactly the same state.
	function loadFile(picked: File) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setFile(picked);
		setPreviewUrl(URL.createObjectURL(picked));
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setCroppedAreaPixels(null);
		setMediaSize(null);
		setFreeCrop(FULL_CROP);
		setFreeformAspect(null);
		setResizeEnabled(false);
		setResultPath(null);
		setResultSize(null);
		setError(null);
	}

	function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
		const picked = e.target.files?.[0];
		e.target.value = "";
		if (picked) loadFile(picked);
	}

	// Fetches server-side since an arbitrary host won't reliably send CORS headers;
	// turns the data URL into a real File so downstream code can't tell it apart from a local pick.
	async function handleUrlImport() {
		const trimmed = urlInput.trim();
		if (!trimmed) return;

		setIsImporting(true);
		setError(null);
		try {
			const dataUrl = await fetchImportedImage(trimmed);
			const blob = await (await fetch(dataUrl)).blob();
			loadFile(new File([blob], "imported", { type: blob.type }));
			setUrlInput("");
		} catch {
			setError("Failed to import image. Try again.");
		} finally {
			setIsImporting(false);
		}
	}

	// AssetBrowser's URL is same-origin, so this fetches directly client-side —
	// unlike handleUrlImport's arbitrary third-party URL, which needs the server round trip.
	async function handleAssetPick(url: string) {
		setIsImportingAsset(true);
		setError(null);
		try {
			const blob = await (await fetch(url)).blob();
			loadFile(new File([blob], "imported", { type: blob.type }));
			setIsBrowserOpen(false);
		} catch {
			setError("Failed to import image. Try again.");
		} finally {
			setIsImportingAsset(false);
		}
	}

	// Plain `setZoom` scales around the image's center, drifting from the crop shape once panned.
	// Reuses the library's own setNewZoom with the container center as the zoom point instead.
	function handleZoomChange(nextZoom: number) {
		const cropper = cropperRef.current;
		const container = cropper?.containerRef;
		if (!cropper || !container) {
			setZoom(nextZoom);
			return;
		}
		const rect = container.getBoundingClientRect();
		const center = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		};
		cropper.setNewZoom(nextZoom, center, { shouldUpdatePosition: true });
	}

	function handleResizeToggle(enabled: boolean) {
		setResizeEnabled(enabled);
		// Starts from the crop's native width so only the change needs typing.
		if (enabled && cropArea) {
			setOutputWidth(String(Math.round(cropArea.width)));
		}
	}

	// Locking a ratio snaps the crop to the largest centered box of that ratio.
	function handleAspectInput(next: { w: string; h: string }) {
		setFreeformAspect(next);
		const ratio = parseAspect(next);
		if (!ratio || !mediaSize) return;
		const { naturalWidth, naturalHeight } = mediaSize;
		const widest = makeAspectCrop(
			{ unit: "%", width: 100 },
			ratio,
			naturalWidth,
			naturalHeight,
		);
		const fitted =
			widest.height > 100
				? makeAspectCrop(
						{ unit: "%", height: 100 },
						ratio,
						naturalWidth,
						naturalHeight,
					)
				: widest;
		setFreeCrop(centerCrop(fitted, naturalWidth, naturalHeight));
	}

	function handleFullImage() {
		setFreeformAspect(null);
		setFreeCrop(FULL_CROP);
	}

	function handleShapeChange(next: CropShapeId) {
		setShapeId(next);
		// A different aspect ratio needs its own crop rect — resetting avoids
		// briefly submitting the previous shape's leftover rect.
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setCroppedAreaPixels(null);
	}

	async function handleSave() {
		if (!file || !cropArea) return;
		if (resizeEnabled && !outputWidthValid) return;
		setIsSaving(true);
		setError(null);
		setCopied(false);
		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("shapeId", shapeId);
			formData.append("crop", JSON.stringify(cropArea));
			if (resizeEnabled) formData.append("outputWidth", outputWidth);
			const { url: path, sizeBytes } = await saveCroppedImageAction(formData);
			setResultPath(path);
			setResultSize(sizeBytes);
			// Auto-copy: copying is always the next step after saving, so skip the manual click.
			await navigator.clipboard.writeText(path);
			setCopied(true);
		} catch {
			setError("Failed to save. Try again.");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleCopy() {
		if (!resultPath) return;
		await navigator.clipboard.writeText(resultPath);
		setCopied(true);
	}

	return (
		<div className={styles.wrapper}>
			<h1>Image crop</h1>
			<p className={styles.hint}>
				Pick a file, pick a shape, position the crop, save — copy the resulting
				path to wherever it&apos;s needed.
			</p>

			<input type="file" accept="image/*" onChange={handleFileChange} />

			<div className={styles.import_row}>
				<input
					type="text"
					className={styles.import_input}
					placeholder="https://…"
					value={urlInput}
					onChange={(e) => setUrlInput(e.target.value)}
					disabled={isImporting}
				/>
				<button
					type="button"
					onClick={handleUrlImport}
					disabled={isImporting || !urlInput.trim()}>
					{isImporting ? "Importing…" : "Import"}
				</button>
			</div>

			<button
				type="button"
				className={styles.banner_search}
				onClick={() => setIsBrowserOpen(true)}
				disabled={isImportingAsset}>
				{isImportingAsset ? "Importing…" : "Browse posters & banners…"}
			</button>

			<div className={styles.shape_row}>
				{Object.entries(CROP_SHAPES).map(([id, shape]) => (
					<label key={id} className={styles.shape_option}>
						<input
							type="radio"
							name="shape"
							checked={shapeId === id}
							onChange={() => handleShapeChange(id as CropShapeId)}
						/>
						{shape.label}
					</label>
				))}
			</div>

			{shapeRatio === null && (
				<div className={styles.aspect_row}>
					Drag the edges to crop. Lock ratio
					<input
						type="number"
						min={1}
						className={styles.number_input}
						placeholder="W"
						value={freeformAspect?.w ?? ""}
						onChange={(e) =>
							handleAspectInput({
								w: e.target.value,
								h: freeformAspect?.h ?? "",
							})
						}
					/>
					:
					<input
						type="number"
						min={1}
						className={styles.number_input}
						placeholder="H"
						value={freeformAspect?.h ?? ""}
						onChange={(e) =>
							handleAspectInput({
								w: freeformAspect?.w ?? "",
								h: e.target.value,
							})
						}
					/>
					<button
						type="button"
						onClick={() => setFreeformAspect(null)}
						disabled={freeformAspect === null}>
						Unlock
					</button>
					<button type="button" onClick={handleFullImage}>
						Full image
					</button>
				</div>
			)}

			{previewUrl && (
				<>
					<div className={styles.cropper_row}>
						{shapeRatio === null ? (
							<div className={styles.freeform_frame}>
								<ReactCrop
									crop={freeCrop}
									onChange={(_, percentCrop) => setFreeCrop(percentCrop)}
									// Spread, not aspect={undefined}: exactOptionalPropertyTypes rejects an explicit undefined.
									{...(lockedAspect ? { aspect: lockedAspect } : {})}
									keepSelection
									ruleOfThirds>
									{/* Plain <img>: a local blob URL, which next/image can't optimize anyway. */}
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={previewUrl}
										alt=""
										className={styles.freeform_image}
										onLoad={(e) => {
											const img = e.currentTarget;
											setMediaSize({
												width: img.width,
												height: img.height,
												naturalWidth: img.naturalWidth,
												naturalHeight: img.naturalHeight,
											});
										}}
									/>
								</ReactCrop>
							</div>
						) : (
							<div className={styles.cropper_frame}>
								<Cropper
									// react-easy-crop bug: switching `aspect` on a letterboxed image corrupts
									// the crop rect. Remounting on shapeId sidesteps it.
									key={shapeId}
									ref={cropperRef}
									image={previewUrl}
									crop={crop}
									zoom={zoom}
									aspect={shapeRatio}
									cropShape={CROP_SHAPES[shapeId].cropShape ?? "rect"}
									onCropChange={setCrop}
									onZoomChange={setZoom}
									onCropSizeChange={setCropSize}
									onMediaLoaded={setMediaSize}
									onCropComplete={(_, areaPixels) =>
										setCroppedAreaPixels(areaPixels)
									}
								/>
								{/* Guide only: marks the zone that survives at small avatar sizes
							(nav_avatar is 35px, so outer-edge detail can blur/vanish). Doesn't affect what's cropped/saved. */}
								{cropSize && CROP_SHAPES[shapeId].cropShape === "round" && (
									<div
										className={styles.safe_margin_circle}
										style={{
											width: cropSize.width * AVATAR_SAFE_MARGIN_RATIO,
											height: cropSize.height * AVATAR_SAFE_MARGIN_RATIO,
										}}
									/>
								)}
							</div>
						)}

						{mediaSize &&
							cropArea &&
							(() => {
								// Reproduces the server's extract() rect via CSS background-position/-size
								// instead of round-tripping on every drag/zoom — both values share extract()'s natural-pixel space.
								const scale = PREVIEW_SIZE / cropArea.width;
								return (
									<div className={styles.preview_column}>
										<span className={styles.preview_label}>Result</span>
										<div
											className={`${styles.preview_frame} ${CROP_SHAPES[shapeId].cropShape === "round" ? styles.preview_frame_round : ""}`}
											style={{
												width: PREVIEW_SIZE,
												height: PREVIEW_SIZE / cropRatio,
												backgroundImage: `url(${previewUrl})`,
												backgroundSize: `${mediaSize.naturalWidth * scale}px ${mediaSize.naturalHeight * scale}px`,
												backgroundPosition: `${-cropArea.x * scale}px ${-cropArea.y * scale}px`,
											}}
										/>
										<span className={styles.preview_label}>
											Crop {Math.round(cropArea.width)} ×{" "}
											{Math.round(cropArea.height)} px
										</span>
									</div>
								);
							})()}
					</div>

					{shapeRatio !== null && (
						<label className={styles.control_row}>
							Zoom
							<input
								type="range"
								min={1}
								max={3}
								step={0.01}
								value={zoom}
								onChange={(e) => handleZoomChange(Number(e.target.value))}
							/>
						</label>
					)}

					<div className={styles.resize_row}>
						<label className={styles.shape_option}>
							<input
								type="checkbox"
								checked={resizeEnabled}
								onChange={(e) => handleResizeToggle(e.target.checked)}
							/>
							Resize to width
						</label>
						{resizeEnabled && (
							<>
								<input
									type="number"
									min={MIN_OUTPUT_WIDTH}
									max={MAX_OUTPUT_WIDTH}
									className={styles.number_input}
									value={outputWidth}
									onChange={(e) => setOutputWidth(e.target.value)}
								/>
								<span className={styles.resize_hint}>
									{outputWidthValid
										? `→ ${parsedOutputWidth} × ${Math.round(parsedOutputWidth / cropRatio)} px`
										: `${MIN_OUTPUT_WIDTH}–${MAX_OUTPUT_WIDTH} px`}
								</span>
							</>
						)}
					</div>

					<button
						type="button"
						className={styles.save_button}
						onClick={handleSave}
						disabled={
							isSaving || !cropArea || (resizeEnabled && !outputWidthValid)
						}>
						{isSaving ? "Saving…" : "Save"}
					</button>
				</>
			)}

			{error && <div className={styles.error}>{error}</div>}

			{resultPath && (
				<div className={styles.result_row}>
					<input
						type="text"
						readOnly
						value={resultPath}
						className={styles.result_input}
					/>
					<button type="button" onClick={handleCopy}>
						{copied ? "Copied!" : "Copy"}
					</button>
				</div>
			)}
			{resultPath && resultSize !== null && (
				<div
					className={
						resultSize > HEAVY_IMAGE_BYTES ? styles.size_warning : styles.hint
					}>
					{formatBytes(resultSize)}
					{resultSize > HEAVY_IMAGE_BYTES &&
						` — over ${formatBytes(HEAVY_IMAGE_BYTES)}. Consider resizing to a smaller width to keep storage down.`}
				</div>
			)}

			{/* Always mounted (visibility toggled via isOpen) so its search/selection state survives being closed and reopened — same reasoning as digest-banner-form.tsx's own usage. */}
			<AssetBrowser
				isOpen={isBrowserOpen}
				onSelect={handleAssetPick}
				onClose={() => setIsBrowserOpen(false)}
			/>
		</div>
	);
}

// Valid W:H lock → ratio; anything incomplete or non-positive → null (unlocked).
function parseAspect(aspect: { w: string; h: string } | null): number | null {
	const w = Number(aspect?.w);
	const h = Number(aspect?.h);
	return aspect && w > 0 && h > 0 ? w / h : null;
}
