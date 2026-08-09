import { mkdir, readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
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

type ShapeFormat = "webp" | "avif";

export type CropRect = { x: number; y: number; width: number; height: number };

// Named top-level constants (not inline path.join() calls at cropAndSave's
// call sites), matching how poster-resolver.ts declares POSTER_DIR/
// BANNER_DIR/etc — every directory this module can ever write to is one of
// these four, fixed at build time.
const POSTER_2_3_DIR = path.join(process.cwd(), "public", "cropped", "poster-2-3");
const POSTER_3_4_DIR = path.join(process.cwd(), "public", "cropped", "poster-3-4");
const BANNER_16_9_DIR = path.join(process.cwd(), "public", "cropped", "banner-16-9");
const LIST_THUMBNAIL_16_9_DIR = path.join(
	process.cwd(),
	"public",
	"cropped",
	"list-thumbnail-16-9",
);

const CROPPED_ROOT = path.join(process.cwd(), "public", "cropped");

// Reads a temp file previously produced by saveCroppedImage, if `url` points
// at one — null for anything else (an external URL, an already-permanent
// local path, or a temp file cleanup-cropped-images.ts has since removed),
// so callers can treat that as "use the URL as given" rather than a hard
// error: a pasted /cropped/ link that's simply gone stale is a
// self-correcting user mistake, not a crash. What a caller does with the
// bytes (copy them into its own real storage) is up to it — this function
// only knows how to recognize and read one of its own temp files back out.
export async function readCroppedFile(url: string): Promise<Buffer | null> {
	if (!url.startsWith("/cropped/")) return null;

	const resolved = path.join(process.cwd(), "public", url);
	// Path traversal guard — url is arbitrary pasted text (a form field),
	// not guaranteed to be a real prior saveCroppedImage output.
	if (!resolved.startsWith(CROPPED_ROOT + path.sep)) return null;

	try {
		return await readFile(resolved);
	} catch {
		return null;
	}
}

// Shared crop+resize+encode+write, parameterized on dir/urlPrefix passed in
// by each case of saveCroppedImage below (one of the four fixed constants
// above — never anything request-derived).
async function cropAndSave(
	source: Buffer,
	shapeId: CropShapeId,
	crop: CropRect,
	dir: string,
	urlPrefix: string,
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
	// turbopackIgnore: dir is always one of the four literal constants above
	// (never request-derived — shapeId only ever selects among them via
	// saveCroppedImage's switch) and filename is a hex hash plus a fixed
	// extension, so this can never escape public/cropped/. Turbopack's
	// build-time filesystem tracer still flags it (tried named constants,
	// parameter indirection, and removing the switch — same warning
	// persisted through all of them) and, without this, traces the entire
	// project into the server bundle as a result.
	const filePath = path.join(/* turbopackIgnore: true */ dir, filename);

	await mkdir(dir, { recursive: true });
	const pipeline = sharp(source)
		.extract({ left, top, width, height })
		.resize({ width: maxWidth, withoutEnlargement: true });
	const encoded =
		format === "avif" ? pipeline.avif({ quality }) : pipeline.webp({ quality });
	await encoded.toFile(filePath);

	return `${urlPrefix}/${filename}`;
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
			return cropAndSave(
				source,
				shapeId,
				crop,
				POSTER_2_3_DIR,
				"/cropped/poster-2-3",
				500,
				POSTER_QUALITY,
				"webp",
			);
		case "poster-3-4":
			return cropAndSave(
				source,
				shapeId,
				crop,
				POSTER_3_4_DIR,
				"/cropped/poster-3-4",
				500,
				POSTER_QUALITY,
				"webp",
			);
		case "banner-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				BANNER_16_9_DIR,
				"/cropped/banner-16-9",
				BANNER_MAX_WIDTH,
				BANNER_QUALITY,
				BANNER_FORMAT,
			);
		case "list-thumbnail-16-9":
			return cropAndSave(
				source,
				shapeId,
				crop,
				LIST_THUMBNAIL_16_9_DIR,
				"/cropped/list-thumbnail-16-9",
				LIST_THUMBNAIL_MAX_WIDTH,
				LIST_THUMBNAIL_QUALITY,
				"webp",
			);
	}
}
