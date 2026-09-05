"use client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import Cropper, { Area, MediaSize, Point } from "react-easy-crop";
import { CROP_SHAPES, CropShapeId } from "./crop-shapes";
import { fetchImportedImage, saveCroppedImageAction } from "./crop-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { AssetBrowser } from "@/components/media/asset-browser/asset-browser";
import styles from "./image-crop-dev.module.sass";

const DEFAULT_SHAPE: CropShapeId = "poster-2-3";

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
	// Mirrors the library's own computed crop rect size, so the vignette
	// overlay below can be sized/positioned to exactly match it.
	const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(
		null,
	);
	// 0-1, not reset on file/shape change — a standing style choice, not tied to a particular image.
	const [vignette, setVignette] = useState(0);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	// Natural pixel dimensions of the loaded image; together with croppedAreaPixels
	// this is what the preview panel needs to reproduce the server's extract() rect via CSS.
	const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultPath, setResultPath] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [isImporting, setIsImporting] = useState(false);
	const [isBrowserOpen, setIsBrowserOpen] = useState(false);
	const [isImportingAsset, setIsImportingAsset] = useState(false);

	useEffect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	if (!isAdmin) {
		return <div className={styles.wrapper}>Admin access required.</div>;
	}

	// Shared by the file picker and URL import so both reset exactly the same state.
	function loadFile(picked: File) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setFile(picked);
		setPreviewUrl(URL.createObjectURL(picked));
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setCroppedAreaPixels(null);
		setMediaSize(null);
		setResultPath(null);
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
		const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		cropper.setNewZoom(nextZoom, center, { shouldUpdatePosition: true });
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
		if (!file || !croppedAreaPixels) return;
		setIsSaving(true);
		setError(null);
		setCopied(false);
		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("shapeId", shapeId);
			formData.append("crop", JSON.stringify(croppedAreaPixels));
			formData.append("vignette", String(vignette));
			const path = await saveCroppedImageAction(formData);
			setResultPath(path);
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
				Pick a file, pick a shape, position the crop, save — copy the
				resulting path to wherever it&apos;s needed.
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

			{previewUrl && (
				<>
					<div className={styles.cropper_row}>
						<div className={styles.cropper_frame}>
							<Cropper
								// react-easy-crop bug: switching `aspect` on a letterboxed image corrupts
								// the crop rect. Remounting on shapeId sidesteps it.
								key={shapeId}
								ref={cropperRef}
								image={previewUrl}
								crop={crop}
								zoom={zoom}
								aspect={CROP_SHAPES[shapeId].ratio}
								cropShape={CROP_SHAPES[shapeId].cropShape ?? "rect"}
								onCropChange={setCrop}
								onZoomChange={setZoom}
								onCropSizeChange={setCropSize}
								onMediaLoaded={setMediaSize}
								onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
							/>
							{/* Preview only, sized to match Cropper's crop rect (see cropSize above);
							the real vignette is baked in server-side on save. pointer-events: none passes drag/zoom through. */}
							{cropSize && (
								<div
									className={`${styles.vignette_overlay} ${CROP_SHAPES[shapeId].cropShape === "round" ? styles.vignette_overlay_round : ""}`}
									style={{
										width: cropSize.width,
										height: cropSize.height,
										opacity: vignette,
									}}
								/>
							)}
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

						{mediaSize &&
							croppedAreaPixels &&
							(() => {
								// Reproduces the server's extract() rect via CSS background-position/-size
								// instead of round-tripping on every drag/zoom — both values share extract()'s natural-pixel space.
								const scale = PREVIEW_SIZE / croppedAreaPixels.width;
								return (
									<div className={styles.preview_column}>
										<span className={styles.preview_label}>Result</span>
										<div
											className={`${styles.preview_frame} ${CROP_SHAPES[shapeId].cropShape === "round" ? styles.preview_frame_round : ""}`}
											style={{
												width: PREVIEW_SIZE,
												height: PREVIEW_SIZE / CROP_SHAPES[shapeId].ratio,
												backgroundImage: `url(${previewUrl})`,
												backgroundSize: `${mediaSize.naturalWidth * scale}px ${mediaSize.naturalHeight * scale}px`,
												backgroundPosition: `${-croppedAreaPixels.x * scale}px ${-croppedAreaPixels.y * scale}px`,
											}}>
											<div
												className={styles.preview_vignette}
												style={{ opacity: vignette }}
											/>
										</div>
									</div>
								);
							})()}
					</div>

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

					<label className={styles.control_row}>
						Vignette
						<input
							type="range"
							min={0}
							max={1}
							step={0.01}
							value={vignette}
							onChange={(e) => setVignette(Number(e.target.value))}
						/>
					</label>

					<button
						type="button"
						className={styles.save_button}
						onClick={handleSave}
						disabled={isSaving || !croppedAreaPixels}>
						{isSaving ? "Saving…" : "Save"}
					</button>
				</>
			)}

			{error && <div className={styles.error}>{error}</div>}

			{resultPath && (
				<div className={styles.result_row}>
					<input type="text" readOnly value={resultPath} className={styles.result_input} />
					<button type="button" onClick={handleCopy}>
						{copied ? "Copied!" : "Copy"}
					</button>
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
