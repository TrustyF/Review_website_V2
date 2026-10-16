import { createHash } from "crypto";
import sharp from "sharp";
import {
	BANNER_FORMAT,
	BANNER_MAX_WIDTH,
	BANNER_QUALITY,
	EMAIL_BANNER_MAX_WIDTH,
	EMAIL_BANNER_QUALITY,
	POSTER_QUALITY,
} from "@/server/resolvers/poster-resolver";
import {
	LIST_THUMBNAIL_MAX_WIDTH,
	LIST_THUMBNAIL_QUALITY,
} from "@/server/resolvers/list-thumbnail-resolver";
import { CropShapeId } from "@/app/dev/image-crop/crop-shapes";
import { getImageStorage } from "@/server/storage/image-storage";

type ShapeFormat = "webp" | "avif" | "jpeg";

// Small square preset-picker thumbnail (see AVATAR_OPTIONS), not hero image, so doesn't need 500px. Quality matches POSTER_QUALITY.
const AVATAR_MAX_WIDTH = 256;
const AVATAR_QUALITY = 80;

// General-purpose crops (e.g. review images): a bit higher than posters since they can be shown large.
const FREEFORM_QUALITY = 85;

export type CropRect = { x: number; y: number; width: number; height: number };

// sizeBytes lets the crop tool flag heavy output before it gets kept anywhere.
export type SavedCrop = { url: string; sizeBytes: number };

// Single dir (content-addressed); different shapes never collide. Transient (24h sweep) — any save
// action accepting a crop must persist it via readCroppedFile immediately, never store this URL.
export const CROPPED_DIR = "cropped";

// Reads temp file from saveCroppedImage (null for anything else).
// Regex guards path traversal; matches hex-hash filename under /cropped/.
const CROPPED_FILE_URL =
	/^(?:https?:\/\/[^/]+)?\/cropped\/([a-f0-9]+\.(?:webp|avif))$/;

export async function readCroppedFile(url: string): Promise<Buffer | null> {
	const match = CROPPED_FILE_URL.exec(url);
	if (!match) return null;
	const [, filename] = match;
	if (!filename) return null;

	return getImageStorage().read(CROPPED_DIR, filename);
}

// Shared crop+resize+encode+write for every case of
// saveCroppedImage below.
async function cropAndSave(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
	// null keeps the crop's own width (freeform).
	maxWidth: number | null,
	quality: number,
	format: ShapeFormat,
	// The optional resize step: exact width, overriding maxWidth, upscaling allowed.
	outputWidth: number | undefined,
): Promise<SavedCrop> {
	const meta = await sharp(source).metadata();
	if (!meta.width || !meta.height) {
		throw new Error("Could not read image dimensions");
	}

	// Clamped defensively — react-easy-crop computes client-side, but rounding could push past edge. sharp's extract() throws rather than clamps.
	const left = Math.max(0, Math.round(crop.x));
	const top = Math.max(0, Math.round(crop.y));
	const width = Math.min(Math.round(crop.width), meta.width - left);
	const height = Math.min(Math.round(crop.height), meta.height - top);

	const hash = createHash("sha256")
		.update(source)
		.update(
			JSON.stringify({
				shapeId,
				left,
				top,
				width,
				height,
				outputWidth,
			}),
		)
		.digest("hex")
		.slice(0, 16);
	const filename = `${hash}.${format}`;

	const finalWidth = outputWidth ?? Math.min(maxWidth ?? width, width);
	const pipeline = sharp(source)
		.extract({ left, top, width, height })
		.resize({ width: finalWidth });

	const encoded =
		format === "avif"
			? pipeline.avif({ quality })
			: format === "jpeg"
				? pipeline.jpeg({ quality })
				: pipeline.webp({ quality });
	const bytes = await encoded.toBuffer();

	const storage = getImageStorage();
	await storage.write(CROPPED_DIR, filename, bytes);
	return {
		url: storage.urlFor(CROPPED_DIR, filename),
		sizeBytes: bytes.length,
	};
}

// Crops to explicit pixel rect (client-computed), resizes per shape settings.
// Reuses existing feature constants for output consistency.
export async function saveCroppedImage(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
	outputWidth?: number,
): Promise<SavedCrop> {
	switch (shapeId) {
		case "freeform":
			return cropAndSave(
				source,
				shapeId,
				crop,
				null,
				FREEFORM_QUALITY,
				"webp",
				outputWidth,
			);
		case "poster-2-3":
			return cropAndSave(
				source,
				shapeId,
				crop,
				500,
				POSTER_QUALITY,
				"webp",
				outputWidth,
			);
		case "poster-3-4":
			return cropAndSave(
				source,
				shapeId,
				crop,
				500,
				POSTER_QUALITY,
				"webp",
				outputWidth,
			);
		case "banner-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				BANNER_MAX_WIDTH,
				BANNER_QUALITY,
				BANNER_FORMAT,
				outputWidth,
			);
		case "digest-banner":
			return cropAndSave(
				source,
				shapeId,
				crop,
				EMAIL_BANNER_MAX_WIDTH,
				EMAIL_BANNER_QUALITY,
				"jpeg",
				outputWidth,
			);
		case "list-thumbnail-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				LIST_THUMBNAIL_MAX_WIDTH,
				LIST_THUMBNAIL_QUALITY,
				"webp",
				outputWidth,
			);
		case "avatar-1-1":
			return cropAndSave(
				source,
				shapeId,
				crop,
				AVATAR_MAX_WIDTH,
				AVATAR_QUALITY,
				"webp",
				outputWidth,
			);
	}
}
