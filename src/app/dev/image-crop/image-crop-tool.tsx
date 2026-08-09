"use client";
import { ChangeEvent, useEffect, useState } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { CROP_SHAPES, CropShapeId } from "./crop-shapes";
import { saveCroppedImageAction } from "./crop-actions";
import { useIsAdminStore } from "@/lib/is-admin-store";
import styles from "./image-crop-dev.module.sass";

const DEFAULT_SHAPE: CropShapeId = "poster-2-3";

// Ad hoc local-file crop-and-save tool: pick a file, pick a shape, drag/zoom
// to position the crop, save — the result is a path meant to be copied out
// and pasted wherever it's needed (a list thumbnail URL field, etc.).
// Nothing in the app calls this automatically. Admin-gated (see
// is-admin-store.ts) rather than dev-gated, since this is meant for
// production use — see crop-actions.ts's own note on why that action still
// has no server-side check either.
export function ImageCropTool() {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [shapeId, setShapeId] = useState<CropShapeId>(DEFAULT_SHAPE);
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resultPath, setResultPath] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		return () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		};
	}, [previewUrl]);

	if (!isAdmin) {
		return <div className={styles.wrapper}>Admin access required.</div>;
	}

	function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
		const picked = e.target.files?.[0];
		e.target.value = "";
		if (!picked) return;

		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setFile(picked);
		setPreviewUrl(URL.createObjectURL(picked));
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setCroppedAreaPixels(null);
		setResultPath(null);
		setError(null);
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
					<div className={styles.cropper_frame}>
						<Cropper
							image={previewUrl}
							crop={crop}
							zoom={zoom}
							aspect={CROP_SHAPES[shapeId].ratio}
							onCropChange={setCrop}
							onZoomChange={setZoom}
							onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
						/>
					</div>

					<label className={styles.control_row}>
						Zoom
						<input
							type="range"
							min={1}
							max={3}
							step={0.01}
							value={zoom}
							onChange={(e) => setZoom(Number(e.target.value))}
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
