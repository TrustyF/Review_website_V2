import { createHash } from "crypto";
import sharp from "sharp";
import { getImageStorage } from "@/server/storage/image-storage";
import {
	DIGEST_BANNER_OVERRIDE_DIR,
	EMAIL_BANNER_MAX_WIDTH,
	EMAIL_BANNER_QUALITY,
} from "./asset-paths";

// Content-addressed bytes (no source URL); JPEG at same width/quality as mail encoding
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

// Recognizes this function's output so re-saving untouched override doesn't re-download/encode. Same idea as list-thumbnail-resolver.ts's isListThumbnailUrl.
const DIGEST_BANNER_OVERRIDE_FILE_URL =
	/^(?:https?:\/\/[^/]+)?\/banners\/digest-override\/[a-f0-9]+\.jpg$/;

export function isDigestBannerOverrideUrl(url: string): boolean {
	return DIGEST_BANNER_OVERRIDE_FILE_URL.test(url);
}

// Fallback self-hosts any URL (pasted link or picker result).
export async function saveDigestBannerOverrideFromUrl(
	url: string,
): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	const bytes = Buffer.from(await res.arrayBuffer());
	return saveDigestBannerOverride(bytes);
}
