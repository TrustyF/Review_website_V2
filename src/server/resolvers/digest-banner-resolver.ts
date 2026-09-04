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
