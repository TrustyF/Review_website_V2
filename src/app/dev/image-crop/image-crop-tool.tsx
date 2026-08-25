"use client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import Cropper, { Area, MediaSize, Point } from "react-easy-crop";
import { CROP_SHAPES, CropShapeId } from "./crop-shapes";
import {
	BannerSearchResult,
	fetchImportedImage,
	saveCroppedImageAction,
	searchMediaForBanner,
} from "./crop-actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import styles from "./image-crop-dev.module.sass";

const DEFAULT_SHAPE: CropShapeId = "poster-2-3";

// Same debounce as featured-manager-modal.tsx's own search — long enough
// that fast typing doesn't fire a query per keystroke, short enough to
// still feel live.
const BANNER_SEARCH_DEBOUNCE_MS = 200;

// Width of the result-preview panel — height follows from the shape's own
// ratio (see the preview style calc below), same as the Cropper's own crop
// rect does.
const PREVIEW_SIZE = 160;

// How much smaller the avatar's "safe zone" guide circle is than the actual
// (outer) crop circle — 0.86 leaves a 7%-of-diameter margin on every side.
// Purely a guide for where the crop tool operator drags/zooms to; nothing
// past this ratio is treated differently on save.
const AVATAR_SAFE_MARGIN_RATIO = 0.86;

// Ad hoc local-file crop-and-save tool: pick a file, pick a shape, drag/zoom
// to position the crop, save — the result is a path meant to be copied out
// and pasted wherever it's needed (a list thumbnail URL field, etc.).
// Nothing in the app calls this automatically. Admin-gated (see
// use-is-admin.ts) rather than dev-gated, since this is meant for
// production use — see crop-actions.ts's own note on why that action still
// has no server-side check either.
export function ImageCropTool() {
	const isAdmin = useIsAdmin();
	const cropperRef = useRef<InstanceType<typeof Cropper>>(null);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [shapeId, setShapeId] = useState<CropShapeId>(DEFAULT_SHAPE);
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	// Mirrors whatever size the library itself computes for the crop rect
	// (aspect × container, recalculated on resize/shape change) — needed so
	// the vignette overlay below can be sized/positioned to exactly match it
	// rather than guessing at a fixed size of its own.
	const [cropSize, setCropSize] = useState<{ width: number; height: number } | null>(
		null,
	);
	// 0–1, not reset on file/shape change — unlike zoom/crop this isn't tied
	// to a particular image or aspect ratio, it's a standing style choice for
	// this save.
	const [vignette, setVignette] = useState(0);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	// Natural (unscaled) pixel dimensions of the loaded image — croppedAreaPixels
	// (below) is already in this same space, so together they're what the
	// result-preview panel needs to reproduce, via CSS background-position/
	// -size, exactly the same extract() rect image-crop-resolver.ts's
	// cropAndSave applies server-side.
	const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultPath, setResultPath] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [isImporting, setIsImporting] = useState(false);
	const [bannerQuery, setBannerQuery] = useState("");
	const [bannerResults, setBannerResults] = useState<BannerSearchResult[]>([]);
	const [isSearchingBanner, setIsSearchingBanner] = useState(false);
	const [isImportingBanner, setIsImportingBanner] = useState(false);

	useEffect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	// Debounced live search as bannerQuery changes — same shape as
	// featured-manager-modal.tsx's own query effect (setState inside the
	// timeout callback, cleared/restarted on every keystroke). The empty-query
	// case clears synchronously from the input's own onChange below instead
	// of here, since setState directly in an effect body (as opposed to
	// inside its setTimeout/async callback) trips
	// react-hooks/set-state-in-effect.
	useEffect(() => {
		if (!bannerQuery.trim()) return;
		const timeout = setTimeout(() => {
			setIsSearchingBanner(true);
			searchMediaForBanner(bannerQuery)
				.then(setBannerResults)
				.finally(() => setIsSearchingBanner(false));
		}, BANNER_SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [bannerQuery]);

	if (!isAdmin) {
		return <div className={styles.wrapper}>Admin access required.</div>;
	}

	// The one place "a new source image was loaded" is defined — shared by
	// the file picker and the URL import below, so a locally-picked file and
	// an imported one reset exactly the same state.
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

	// Fetches server-side (crop-actions.ts's fetchImportedImage — an arbitrary
	// host won't reliably send CORS headers a browser fetch would need),
	// then turns the returned data URL into a real File so everything past
	// this point (Cropper, handleSave) can't tell it apart from a local pick.
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

	// Same shape as handleUrlImport above, just sourced from a picked search
	// result's bannerSrc instead of a typed-in URL.
	async function handleBannerPick(result: BannerSearchResult) {
		setIsImportingBanner(true);
		setError(null);
		try {
			const dataUrl = await fetchImportedImage(result.bannerSrc);
			const blob = await (await fetch(dataUrl)).blob();
			loadFile(new File([blob], "imported", { type: blob.type }));
			setBannerQuery("");
			setBannerResults([]);
		} catch {
			setError("Failed to import banner. Try again.");
		} finally {
			setIsImportingBanner(false);
		}
	}

	// Plain `setZoom` alone reproduces react-easy-crop's own default: the
	// image scales around its own center (CSS transform-origin), which drifts
	// away from the crop shape the moment you've panned at all — the shape
	// stays put while the image balloons out from wherever its center
	// happens to be. Internally the library avoids exactly this for
	// wheel/pinch zoom by re-deriving `crop` (the pan offset) alongside
	// `zoom` so a chosen point stays fixed on screen — see this package's own
	// onWheel/onPinchMove, both of which call setNewZoom with the pointer/
	// pinch-center point. That same method is reused here with the
	// container's own center as the point (getPointOnContainer resolves a
	// page-space point equal to the container's center to {x:0, y:0}, i.e.
	// "no offset from center" — exactly what the crop shape sits on, since
	// it's always centered in the container), so dragging the slider zooms
	// toward the shape instead.
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
			setResultPath(await saveCroppedImageAction(formData));
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

			<div className={styles.banner_search}>
				<input
					type="text"
					className={styles.import_input}
					placeholder="Search a movie/show/game for its banner…"
					value={bannerQuery}
					onChange={(e) => {
						const value = e.target.value;
						setBannerQuery(value);
						if (!value.trim()) setBannerResults([]);
					}}
					disabled={isImportingBanner}
				/>
				{isSearchingBanner && <div className={styles.uploading}>Searching…</div>}
				{bannerResults.length > 0 && (
					<div className={styles.banner_results}>
						{bannerResults.map((result) => (
							<button
								key={result.id}
								type="button"
								className={styles.banner_result}
								disabled={isImportingBanner}
								onClick={() => handleBannerPick(result)}>
								{/* Arbitrary proxied/cached poster URL, same reasoning as
								every other search-result thumbnail in this app for using a
								plain <img> instead of next/image. */}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={result.posterSrc}
									alt=""
									className={styles.banner_result_poster}
								/>
								<span>{result.title}</span>
							</button>
						))}
					</div>
				)}
			</div>

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
								// react-easy-crop has a bug where switching `aspect` on an
								// already-loaded image that's letterboxed (its display doesn't
								// fill the container height — e.g. a wide image inside this
								// fixed-height frame) recomputes the crop rect against the
								// container's own height instead of the image's actual
								// rendered height, so the round/rect guide (and everything
								// derived from it, including the Result preview and the saved
								// crop) ends up wrong — confirmed by comparing DOM rects
								// before/after a shape switch; a fresh mount always computes
								// correctly. Remounting on shapeId sidesteps the library's
								// internal update path entirely rather than fighting it.
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
							{/* Sits on top of Cropper's own crop rect, sized/positioned to
							match it exactly (see cropSize's own comment above) — shows
							what the vignette will look like without actually touching the
							source image; the real one only gets baked in server-side on
							save (see image-crop-resolver.ts's cropAndSave). pointer-events:
							none so drag/zoom on the image underneath still works through it. */}
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
							{/* Guide only — a smaller circle inset from the actual (outer)
							crop circle, marking the zone that survives however small an
							avatar ends up displayed elsewhere (nav_avatar is 35px — corner-
							ish detail near the outer edge can blur/vanish at that size).
							Purely visual: nothing here changes what's cropped/saved. */}
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
								// Reproduces image-crop-resolver.ts's own extract() rect via
								// CSS background-position/-size instead of round-tripping to
								// the server on every drag/zoom — croppedAreaPixels and
								// mediaSize are both in the same natural-pixel space
								// extract() itself works in, so this is exactly "source
								// pixels per preview pixel," the one number a background-
								// image needs to reproduce an arbitrary crop rect at a
								// different display size.
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
		</div>
	);
}
