import { mkdir } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import sharp from "sharp";

// Capped well below what this ever actually renders at — a list thumbnail
// only shows inside ListPreviewCard's 16:9 grid card or the edit form's own
// small preview (see list-form.module.sass's 20rem max-width), nowhere near
// full size.
// Exported so the generic /dev/image-crop tool's "List thumbnail" shape can
// reuse these instead of redeclaring the same numbers — see
// image-crop-resolver.ts.
export const LIST_THUMBNAIL_MAX_WIDTH = 640;
export const LIST_THUMBNAIL_QUALITY = 90;

const LIST_THUMBNAIL_DIR = path.join(
	process.cwd(),
	"public",
	"list-thumbnails",
);

// Content-addressed by the uploaded bytes themselves, same idea as
// mediaAssetFilename in poster-resolver.ts — except an uploaded file has no
// source URL to hash, only the bytes the user just picked off disk.
export async function saveListThumbnail(source: Buffer): Promise<string> {
	const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
	const filename = `${hash}.webp`;
	const filePath = path.join(LIST_THUMBNAIL_DIR, filename);

	await mkdir(LIST_THUMBNAIL_DIR, { recursive: true });
	await sharp(source)
		.resize({ width: LIST_THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
		.webp({ quality: LIST_THUMBNAIL_QUALITY })
		.toFile(filePath);

	return `/list-thumbnails/${filename}`;
}
