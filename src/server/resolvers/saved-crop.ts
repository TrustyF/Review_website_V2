import { createHash } from "crypto";
import { fetchImage } from "@/server/lib/fetch-image";
import { parseSavedCropPath } from "@/server/resolvers/asset-paths";
import { getImageStorage } from "@/server/storage/image-storage";

type FetchedImage = { bytes: Buffer; contentType: string };

const CONTENT_TYPES: Record<string, string> = {
	webp: "image/webp",
	avif: "image/avif",
	jpeg: "image/jpeg",
};

// Copies a crop's bytes into its durable dir (POSTER_CROP_DIR/BANNER_CROP_DIR); returns the URL
// to store in Media.posterPath/bannerPath. Content-addressed, so re-saving the same crop is a no-op.
export async function saveCrop(
	dir: string,
	bytes: Buffer,
	ext: string,
): Promise<string> {
	const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
	const filename = `${hash}.${ext}`;
	const storage = getImageStorage();
	await storage.write(dir, filename, bytes);
	return storage.urlFor(dir, filename);
}

// cropped/ URLs end in the crop's encoded format (webp/avif).
export function cropExtension(url: string): string {
	return /\.(\w+)$/.exec(url)?.[1] ?? "webp";
}

// Source fetch for media images: saved crops are read straight from storage (their local-disk
// URLs are root-relative, so not fetchable server-side); anything else goes over HTTP.
export async function fetchMediaImage(url: string): Promise<FetchedImage> {
	const saved = parseSavedCropPath(url);
	if (saved) {
		const bytes = await getImageStorage().read(saved.dir, saved.filename);
		if (!bytes) throw new Error(`Saved crop missing: ${url}`);
		const ext = saved.filename.split(".").pop() ?? "";
		return { bytes, contentType: CONTENT_TYPES[ext] ?? "image/webp" };
	}
	return fetchImage(url);
}
