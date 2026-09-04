import { createHash } from "crypto";
import sharp from "sharp";
import { getImageStorage } from "@/server/storage/image-storage";
import {
	DIGEST_BANNER_OVERRIDE_DIR,
	EMAIL_BANNER_MAX_WIDTH,
	EMAIL_BANNER_QUALITY,
} from "./asset-paths";

// Content-addressed by the uploaded bytes, same idea as saveListThumbnail —
// an admin-picked override has no source URL to hash. JPEG at the same
// width/quality as resolveEmailBanner's own mail-client-safe encoding.
export async function saveDigestBannerOverride(
	source: Buffer,
): Promise<string> {
	const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
	const filename = `${hash}.jpg`;

	const bytes = await sharp(source)
		.resize({ width: EMAIL_BANNER_MAX_WIDTH, withoutEnlargement: true })
		.jpeg({ quality: EMAIL_BANNER_QUALITY })
		.toBuffer();

	const storage = getImageStorage();
	await storage.write(DIGEST_BANNER_OVERRIDE_DIR, filename, bytes);
	return storage.urlFor(DIGEST_BANNER_OVERRIDE_DIR, filename);
}

// Recognizes this function's own output — same idea as
// list-thumbnail-resolver.ts's isListThumbnailUrl — so re-saving an
// untouched override doesn't re-download/re-encode it.
const DIGEST_BANNER_OVERRIDE_FILE_URL =
	/^(?:https?:\/\/[^/]+)?\/banners\/digest-override\/[a-f0-9]+\.jpg$/;

export function isDigestBannerOverrideUrl(url: string): boolean {
	return DIGEST_BANNER_OVERRIDE_FILE_URL.test(url);
}

// Generic fallback for the admin form's "image" field: self-hosts any other
// URL (a pasted link, or one handed back by the asset browser's picker,
// itself a same-origin /api/image-proxy URL) so the override never depends
// on a third-party host staying up.
export async function saveDigestBannerOverrideFromUrl(
	url: string,
): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	const bytes = Buffer.from(await res.arrayBuffer());
	return saveDigestBannerOverride(bytes);
}
