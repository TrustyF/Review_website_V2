import { createHash } from "crypto";
import { HEAVY_IMAGE_BYTES } from "@/app/dev/image-crop/crop-shapes";
import { reviewImageDir } from "@/server/resolvers/asset-paths";
import { readCroppedFile } from "@/server/resolvers/image-crop-resolver";
import { getImageStorage } from "@/server/storage/image-storage";

// heavyBytes: nothing was written, the caller should confirm and retry with allowHeavy.
export type ReviewImageResult = { url: string } | { heavyBytes: number };

// A crop's bytes live in the transient cropped/ store (swept after 24h), so copy them into the
// media's own review-image dir, same as persistCroppedPoster. Any other URL is returned as-is.
export async function persistReviewImage(
	mediaId: number,
	url: string,
	allowHeavy: boolean,
): Promise<ReviewImageResult> {
	const bytes = await readCroppedFile(url);
	if (!bytes) return { url };
	if (!allowHeavy && bytes.length > HEAVY_IMAGE_BYTES) {
		return { heavyBytes: bytes.length };
	}

	const ext = /\.(\w+)$/.exec(url)?.[1] ?? "webp";
	const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
	const filename = `${hash}.${ext}`;

	const storage = getImageStorage();
	const dir = reviewImageDir(mediaId);
	await storage.write(dir, filename, bytes);
	return { url: storage.urlFor(dir, filename) };
}
