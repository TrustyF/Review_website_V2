import { createHash } from "crypto";
import sharp from "sharp";
import { getImageStorage } from "@/server/storage/image-storage";
import { toAbsoluteUrl } from "@/server/email/mailer";

// Capped well below actual render size (only shows in ListPreviewCard's grid or edit form). Exported so /dev/image-crop tool's "List thumbnail" shape can reuse.
export const LIST_THUMBNAIL_MAX_WIDTH = 640;
export const LIST_THUMBNAIL_QUALITY = 90;

// Logical ImageStorage key, not a real filesystem path — see
// src/server/storage/image-storage.ts.
const LIST_THUMBNAIL_DIR = "list-thumbnails";

// Content-addressed by bytes (no source URL like poster-resolver).
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

// Recognizes own output; resolveThumbnailUrl uses to skip re-fetch if unchanged.
const LIST_THUMBNAIL_FILE_URL =
	/^(?:https?:\/\/[^/]+)?\/list-thumbnails\/[a-f0-9]+\.webp$/;

export function isListThumbnailUrl(url: string): boolean {
	return LIST_THUMBNAIL_FILE_URL.test(url);
}

// Fallback for non-permanent URLs; downloads and self-hosts to avoid hotlinks
export async function saveListThumbnailFromUrl(url: string): Promise<string> {
	// AssetBrowser hands back a root-relative /api/image-proxy/... URL — fetch()
	// has no implicit base URL server-side, so it needs to be absolute first.
	const res = await fetch(toAbsoluteUrl(url));
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	const bytes = Buffer.from(await res.arrayBuffer());
	return saveListThumbnail(bytes);
}
