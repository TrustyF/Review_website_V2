import { createHash } from "crypto";
import sharp from "sharp";
import { getImageStorage } from "@/server/storage/image-storage";
import { toAbsoluteUrl } from "@/server/email/mailer";

// Capped well below what this ever actually renders at — a list thumbnail
// only shows inside ListPreviewCard's 16:9 grid card or the edit form's own
// small preview (see list-form.module.sass's 20rem max-width), nowhere near
// full size.
// Exported so the generic /dev/image-crop tool's "List thumbnail" shape can
// reuse these instead of redeclaring the same numbers — see
// image-crop-resolver.ts.
export const LIST_THUMBNAIL_MAX_WIDTH = 640;
export const LIST_THUMBNAIL_QUALITY = 90;

// Logical ImageStorage key, not a real filesystem path — see
// src/server/storage/image-storage.ts.
const LIST_THUMBNAIL_DIR = "list-thumbnails";

// Content-addressed by the uploaded bytes themselves, same idea as
// mediaAssetFilename in poster-resolver.ts — except an uploaded file has no
// source URL to hash, only the bytes the user just picked off disk.
export async function saveListThumbnail(source: Buffer): Promise<string> {
	const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
	const filename = `${hash}.webp`;

	const bytes = await sharp(source)
		.resize({ width: LIST_THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
		.webp({ quality: LIST_THUMBNAIL_QUALITY })
		.toBuffer();

	const storage = getImageStorage();
	await storage.write(LIST_THUMBNAIL_DIR, filename, bytes);
	return storage.urlFor(LIST_THUMBNAIL_DIR, filename);
}

// Recognizes this function's own output — resolveThumbnailUrl (list-actions.ts)
// uses this to skip re-fetching/re-encoding a thumbnail that's already
// permanent (an untouched edit re-submitting the same value). Matches either
// storage backend's urlFor() form: LocalImageStorage's bare "/list-thumbnails/…"
// or R2ImageStorage's "https://<R2_PUBLIC_URL>/list-thumbnails/…".
const LIST_THUMBNAIL_FILE_URL =
	/^(?:https?:\/\/[^/]+)?\/list-thumbnails\/[a-f0-9]+\.webp$/;

export function isListThumbnailUrl(url: string): boolean {
	return LIST_THUMBNAIL_FILE_URL.test(url);
}

// Generic fallback for resolveThumbnailUrl — any link that isn't already a
// permanent list-thumbnails file (see isListThumbnailUrl) or a recognized
// /cropped/ temp file (see readCroppedFile) gets downloaded here and
// re-hosted the same way an uploaded file would be, so a list's thumbnail
// never stays a live hotlink to whatever site the URL was pasted from.
export async function saveListThumbnailFromUrl(url: string): Promise<string> {
	// AssetBrowser hands back a root-relative /api/image-proxy/... URL — fetch()
	// has no implicit base URL server-side, so it needs to be absolute first.
	const res = await fetch(toAbsoluteUrl(url));
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	const bytes = Buffer.from(await res.arrayBuffer());
	return saveListThumbnail(bytes);
}
