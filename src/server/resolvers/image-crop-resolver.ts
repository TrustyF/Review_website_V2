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

export type CropRect = { x: number; y: number; width: number; height: number };

// Single dir (content-addressed); different shapes never collide.
export const CROPPED_DIR = "cropped";

// Reads temp file from saveCroppedImage (null for anything else).
// Regex guards path traversal; matches hex-hash filename under /cropped/.
const CROPPED_FILE_URL = /^(?:https?:\/\/[^/]+)?\/cropped\/([a-f0-9]+\.(?:webp|avif))$/;

export async function readCroppedFile(url: string): Promise<Buffer | null> {
	const match = CROPPED_FILE_URL.exec(url);
	if (!match) return null;
	const [, filename] = match;
	if (!filename) return null;

	return getImageStorage().read(CROPPED_DIR, filename);
}

// Radial SVG gradient overlay composited to pixels; 55% inner stop matches preview
function buildVignetteSvg(width: number, height: number, strength: number): Buffer {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="v" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="${strength}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
	return Buffer.from(svg);
}

// Shared crop+resize+vignette+encode+write for every case of
// saveCroppedImage below.
async function cropAndSave(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
	maxWidth: number,
	quality: number,
	format: ShapeFormat,
	vignette: number,
): Promise<string> {
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
		.update(JSON.stringify({ shapeId, left, top, width, height, vignette }))
		.digest("hex")
		.slice(0, 16);
	const filename = `${hash}.${format}`;

	let pipeline = sharp(source)
		.extract({ left, top, width, height })
		.resize({ width: maxWidth, withoutEnlargement: true });

	if (vignette > 0) {
		// resize({width}) preserves rect ratio; mirrors that rather than
		// re-reading metadata.
		const outputWidth = Math.min(maxWidth, width);
		const outputHeight = Math.round(height * (outputWidth / width));
		pipeline = sharp(await pipeline.toBuffer()).composite([
			{ input: buildVignetteSvg(outputWidth, outputHeight, vignette), blend: "over" },
		]);
	}

	const encoded =
		format === "avif"
			? pipeline.avif({ quality })
			: format === "jpeg"
				? pipeline.jpeg({ quality })
				: pipeline.webp({ quality });
	const bytes = await encoded.toBuffer();

	const storage = getImageStorage();
	await storage.write(CROPPED_DIR, filename, bytes);
	return storage.urlFor(CROPPED_DIR, filename);
}

// Crops to explicit pixel rect (client-computed), resizes per shape settings.
// Reuses existing feature constants for output consistency.
export async function saveCroppedImage(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
	vignette = 0,
): Promise<string> {
	switch (shapeId) {
		case "poster-2-3":
			return cropAndSave(source, shapeId, crop, 500, POSTER_QUALITY, "webp", vignette);
		case "poster-3-4":
			return cropAndSave(source, shapeId, crop, 500, POSTER_QUALITY, "webp", vignette);
		case "banner-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				BANNER_MAX_WIDTH,
				BANNER_QUALITY,
				BANNER_FORMAT,
				vignette,
			);
		case "digest-banner":
			return cropAndSave(
				source,
				shapeId,
				crop,
				EMAIL_BANNER_MAX_WIDTH,
				EMAIL_BANNER_QUALITY,
				"jpeg",
				vignette,
			);
		case "list-thumbnail-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				LIST_THUMBNAIL_MAX_WIDTH,
				LIST_THUMBNAIL_QUALITY,
				"webp",
				vignette,
			);
		case "avatar-1-1":
			return cropAndSave(
				source,
				shapeId,
				crop,
				AVATAR_MAX_WIDTH,
				AVATAR_QUALITY,
				"webp",
				vignette,
			);
	}
}
