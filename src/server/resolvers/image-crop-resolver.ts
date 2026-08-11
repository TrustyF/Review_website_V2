import { createHash } from "crypto";
import sharp from "sharp";
import {
	BANNER_FORMAT,
	BANNER_MAX_WIDTH,
	BANNER_QUALITY,
	POSTER_QUALITY,
} from "@/server/resolvers/poster-resolver";
import {
	LIST_THUMBNAIL_MAX_WIDTH,
	LIST_THUMBNAIL_QUALITY,
} from "@/server/resolvers/list-thumbnail-resolver";
import { CropShapeId } from "@/app/dev/image-crop/crop-shapes";
import { getImageStorage } from "@/server/storage/image-storage";

type ShapeFormat = "webp" | "avif";

export type CropRect = { x: number; y: number; width: number; height: number };

// Every shape shares this one dir — filenames are already content-addressed
// from {source bytes, shapeId, crop rect} (see cropAndSave's hash below), so
// shapeId is baked into the hash and different shapes can never collide on
// the same filename. Logical ImageStorage key, not a real filesystem path —
// see src/server/storage/image-storage.ts. Exported so
// cleanup-cropped-images.ts doesn't need its own copy.
export const CROPPED_DIR = "cropped";

// Reads a temp file previously produced by saveCroppedImage, if `url` points
// at one — null for anything else (an external URL, an already-permanent
// local path, or a temp file cleanup-cropped-images.ts has since removed),
// so callers can treat that as "use the URL as given" rather than a hard
// error: a pasted /cropped/ link that's simply gone stale is a
// self-correcting user mistake, not a crash. What a caller does with the
// bytes (copy them into its own real storage) is up to it — this function
// only knows how to recognize and read one of its own temp files back out.
//
// The regex is the path-traversal guard here (replacing the old "resolve to
// a real path and check it's still inside CROPPED_ROOT" check, which doesn't
// apply once storage is no longer necessarily a real filesystem): url is
// arbitrary pasted text (a form field), and this only matches a bare
// hex-hash filename directly under /cropped/, so there's no `../`-style
// segment for either backend to misinterpret.
const CROPPED_FILE_URL = /^\/cropped\/([a-f0-9]+\.(?:webp|avif))$/;

export async function readCroppedFile(url: string): Promise<Buffer | null> {
	const match = CROPPED_FILE_URL.exec(url);
	if (!match) return null;
	const [, filename] = match;
	if (!filename) return null;

	return getImageStorage().read(CROPPED_DIR, filename);
}

// Shared crop+resize+encode+write for every case of saveCroppedImage below.
async function cropAndSave(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
	maxWidth: number,
	quality: number,
	format: ShapeFormat,
): Promise<string> {
	const meta = await sharp(source).metadata();
	if (!meta.width || !meta.height) {
		throw new Error("Could not read image dimensions");
	}

	// Clamped defensively — react-easy-crop computes crop from the real image
	// dimensions client-side already, but rounding could push it a pixel past
	// an edge, and sharp's extract() throws rather than clamps.
	const left = Math.max(0, Math.round(crop.x));
	const top = Math.max(0, Math.round(crop.y));
	const width = Math.min(Math.round(crop.width), meta.width - left);
	const height = Math.min(Math.round(crop.height), meta.height - top);

	const hash = createHash("sha256")
		.update(source)
		.update(JSON.stringify({ shapeId, left, top, width, height }))
		.digest("hex")
		.slice(0, 16);
	const filename = `${hash}.${format}`;

	const pipeline = sharp(source)
		.extract({ left, top, width, height })
		.resize({ width: maxWidth, withoutEnlargement: true });
	const encoded =
		format === "avif" ? pipeline.avif({ quality }) : pipeline.webp({ quality });
	const bytes = await encoded.toBuffer();

	const storage = getImageStorage();
	await storage.write(CROPPED_DIR, filename, bytes);
	return storage.urlFor(CROPPED_DIR, filename);
}

// Crops to an explicit pixel rect (already computed client-side by
// react-easy-crop's onCropComplete, in the source image's own pixel space —
// no ratio/centering math needed here, unlike a focus-point-only approach),
// then resizes/re-encodes per the chosen shape's settings. Reuses each
// existing feature's own constants (poster-resolver.ts,
// list-thumbnail-resolver.ts) rather than redeclaring them, so this tool's
// output matches what that feature would actually produce/expect.
export async function saveCroppedImage(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
): Promise<string> {
	switch (shapeId) {
		case "poster-2-3":
			return cropAndSave(source, shapeId, crop, 500, POSTER_QUALITY, "webp");
		case "poster-3-4":
			return cropAndSave(source, shapeId, crop, 500, POSTER_QUALITY, "webp");
		case "banner-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				BANNER_MAX_WIDTH,
				BANNER_QUALITY,
				BANNER_FORMAT,
			);
		case "list-thumbnail-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				LIST_THUMBNAIL_MAX_WIDTH,
				LIST_THUMBNAIL_QUALITY,
				"webp",
			);
	}
}
