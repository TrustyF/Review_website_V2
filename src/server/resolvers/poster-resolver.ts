import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { after } from "next/server";
import { MediaType } from "@prisma/client";
import { getImageStorage } from "@/server/storage/image-storage";
import {
	BANNER_DIR,
	BANNER_FORMAT,
	BANNER_MAX_WIDTH,
	BANNER_QUALITY,
	CHANGELOG_BANNER_THUMB_DIR,
	CHANGELOG_THUMB_DIR,
	LINK_EMBED_DIR,
	PERSON_PHOTO_DIR,
	PERSON_PHOTO_MAX_WIDTH,
	PERSON_PHOTO_QUALITY,
	POSTER_DIR,
	POSTER_QUALITY,
	bannerUrlFor,
	mediaAssetFilename,
	personPhotoUrlFor,
	posterUrlFor,
	type CacheFormat,
} from "@/server/resolvers/asset-paths";

// Re-exported for callers that only need the URL/filename helpers — new
// perf-sensitive callers should import asset-paths.ts directly instead, so
// their bundle skips sharp's native binary.
export * from "@/server/resolvers/asset-paths";

// Change log thumbnails only ever display at 46x69 CSS px — re-encoding to
// this height regardless of source guarantees a small cached file even for
// sources (ComicVine, manual entries) with no smaller variant to request.
const THUMB_MAX_HEIGHT = 140;
// Same idea as THUMB_MAX_HEIGHT, sized down from BANNER_MAX_WIDTH instead —
// see resolveChangelogBannerThumb.
const BANNER_THUMB_MAX_WIDTH = 120;

// Poster resized to this height (width follows its own aspect ratio) for
// the link-preview image — plenty of resolution for Discord/WhatsApp's
// unfurl cards without shipping the full-size source.
const LINK_EMBED_HEIGHT = 630;
// JPEG needs a higher quality number than WebP/AVIF for similar fidelity —
// deliberately above POSTER_QUALITY's 50 rather than reused from it.
const LINK_EMBED_QUALITY = 60;

// Keyed by "dir/filename" so a resize/encode already running for a cache
// miss is reused instead of redone by concurrent requests for the same
// not-yet-cached asset. Module-scope, so it only dedupes within one warm
// instance — exactly what Fluid's higher per-instance concurrency needs.
const inFlightEncodes = new Map<string, Promise<Buffer>>();

function dedupeEncode(
	key: string,
	run: () => Promise<Buffer>,
): Promise<Buffer> {
	const existing = inFlightEncodes.get(key);
	if (existing) return existing;
	const promise = run().finally(() => inFlightEncodes.delete(key));
	inFlightEncodes.set(key, promise);
	return promise;
}

// Shared content-addressed cache-or-download logic for resolvePoster,
// resolveChangelogPosterThumb, and resolveBanner-adjacent thumbs — differs
// only in directory, source size, and resize. Goes through ImageStorage so
// it works unchanged against local disk or a remote object store.
async function cacheOrDownload(
	dir: string,
	filename: string,
	sourceUrl: string,
	{ resize }: { resize?: { width?: number; height?: number } } = {},
	quality = POSTER_QUALITY,
	format: CacheFormat = "webp",
): Promise<{ bytes: Buffer }> {
	const storage = getImageStorage();

	const cached = await storage.read(dir, filename);
	if (cached) return { bytes: cached };

	const bytes = await dedupeEncode(`${dir}/${filename}`, async () => {
		const res = await fetch(sourceUrl);
		if (!res.ok) throw new Error("Poster download failed");
		const source = Buffer.from(await res.arrayBuffer());
		let image = sharp(source);
		if (resize) {
			image = image.resize({ ...resize, withoutEnlargement: true });
		}
		const encoded =
			format === "avif"
				? image.avif({ quality })
				: format === "jpeg"
					? image.jpeg({ quality })
					: image.webp({ quality });
		const bytes = await encoded.toBuffer();
		await storage.write(dir, filename, bytes);
		return bytes;
	});
	return { bytes };
}

// Plain Uint8Array, not Node's Buffer<ArrayBufferLike> — NextResponse's
// BodyInit type only resolves cleanly against the plain one.
export type ResolvedAsset = { bytes: Uint8Array; contentType: string };

const PLACEHOLDER_POSTER_PATH = path.join(
	process.cwd(),
	"public",
	"posters",
	"placeholder.jpg",
);

// Returns the actual bytes — /api/poster hands these straight back as the
// response body. Same fresh-miss shape as resolveBanner: on a cache miss the
// raw source returns immediately, and resize/encode/write happens in
// `after()`, off the critical path.
export async function resolvePoster(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string | null,
): Promise<ResolvedAsset & { fresh: boolean }> {
	if (!posterPath) {
		return {
			bytes: await readFile(PLACEHOLDER_POSTER_PATH),
			contentType: "image/jpeg",
			fresh: false,
		};
	}

	const filename = mediaAssetFilename(mediaId, posterPath);
	const storage = getImageStorage();

	const cached = await storage.read(POSTER_DIR, filename);
	if (cached) {
		return { bytes: cached, contentType: "image/webp", fresh: false };
	}

	const sourceUrl = posterUrlFor(type, externalId, posterPath, "full");
	const res = await fetch(sourceUrl);
	if (!res.ok) throw new Error("Poster download failed");
	const source = Buffer.from(await res.arrayBuffer());
	const sourceContentType = res.headers.get("content-type") || "image/jpeg";

	// Posters are deliberately never resized down — just re-encoded to WebP.
	const encode = () =>
		dedupeEncode(`${POSTER_DIR}/${filename}`, async () => {
			const encoded = await sharp(source)
				.webp({ quality: POSTER_QUALITY })
				.toBuffer();
			await storage.write(POSTER_DIR, filename, encoded);
			return encoded;
		});

	after(async () => {
		await encode();
	});

	return { bytes: source, contentType: sourceContentType, fresh: true };
}

async function fetchImageBytes(url: string): Promise<Buffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	return Buffer.from(await res.arrayBuffer());
}

// The link-preview image is just the poster itself, re-encoded to JPEG
// (crawlers need JPEG/PNG reliably, unlike the site's own WebP poster cache)
// and resized to LINK_EMBED_HEIGHT. No banner backdrop/compositing — Discord
// and WhatsApp both render a plain poster-shaped image fine.
export async function resolveLinkEmbedImage(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string | null,
	// Lets the dev preview tool force a fresh encode (and skip persisting it)
	// instead of serving/writing the disk cache.
	skipCache = false,
): Promise<ResolvedAsset | null> {
	if (!posterPath) return null;

	const filename = mediaAssetFilename(mediaId, posterPath, "jpeg");
	const storage = getImageStorage();

	if (!skipCache) {
		const cached = await storage.read(LINK_EMBED_DIR, filename);
		if (cached) return { bytes: cached, contentType: "image/jpeg" };
	}

	const bytes = await dedupeEncode(
		`${LINK_EMBED_DIR}/${filename}`,
		async () => {
			const posterBytes = await fetchImageBytes(
				posterUrlFor(type, externalId, posterPath, "full"),
			);

			const bytes = await sharp(posterBytes)
				.resize({ height: LINK_EMBED_HEIGHT })
				.jpeg({ quality: LINK_EMBED_QUALITY })
				.toBuffer();

			if (!skipCache) await storage.write(LINK_EMBED_DIR, filename, bytes);
			return bytes;
		},
	);
	return { bytes, contentType: "image/jpeg" };
}

// Same content-addressable caching as resolvePoster, but for a change log
// entry's old/new posterPath — stays resolvable even after the poster's
// since been replaced or the media deleted.
export async function resolveChangelogPosterThumb(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string,
) {
	const filename = mediaAssetFilename(mediaId, posterPath);
	await cacheOrDownload(
		CHANGELOG_THUMB_DIR,
		filename,
		posterUrlFor(type, externalId, posterPath, "thumb"),
		{ resize: { height: THUMB_MAX_HEIGHT } },
		50,
	);

	return getImageStorage().urlFor(CHANGELOG_THUMB_DIR, filename);
}

// Doesn't share cacheOrDownload's shape — a banner source is large enough
// that resize + AVIF re-encode is the slow part of a cache miss, not the
// download, which made a first-time banner load noticeably slow on Vercel.
// A miss returns the raw source immediately and resizes/encodes/writes in
// `after()`, off the critical path — the next request finds it cached.
export async function resolveBanner(
	mediaId: number,
	type: MediaType,
	bannerPath: string | null,
): Promise<(ResolvedAsset & { fresh: boolean }) | null> {
	if (!bannerPath) return null;

	const filename = mediaAssetFilename(mediaId, bannerPath, BANNER_FORMAT);
	const storage = getImageStorage();

	const cached = await storage.read(BANNER_DIR, filename);
	if (cached) {
		return {
			bytes: cached,
			contentType: `image/${BANNER_FORMAT}`,
			fresh: false,
		};
	}

	const res = await fetch(bannerUrlFor(type, bannerPath));
	if (!res.ok) throw new Error("Banner download failed");
	const source = Buffer.from(await res.arrayBuffer());
	// Read off the response rather than hardcoded, so it stays correct if a
	// source ever changes format.
	const sourceContentType = res.headers.get("content-type") || "image/jpeg";

	// Deduped so concurrent misses on this banner don't each redo the
	// resize/encode/write.
	const encode = () =>
		dedupeEncode(`${BANNER_DIR}/${filename}`, async () => {
			const encoded = await sharp(source)
				.resize({ width: BANNER_MAX_WIDTH, withoutEnlargement: true })
				.avif({ quality: BANNER_QUALITY })
				.toBuffer();
			await storage.write(BANNER_DIR, filename, encoded);
			return encoded;
		});

	after(async () => {
		await encode();
	});

	return { bytes: source, contentType: sourceContentType, fresh: true };
}

// Same fresh-miss/deferred-encode shape as resolvePoster/resolveBanner, just
// a smaller resize target and no placeholder fallback — callers only reach
// this once a photoPath is already confirmed to exist.
export async function resolvePersonPhoto(
	personId: number,
	photoPath: string,
): Promise<ResolvedAsset & { fresh: boolean }> {
	const filename = mediaAssetFilename(personId, photoPath);
	const storage = getImageStorage();

	const cached = await storage.read(PERSON_PHOTO_DIR, filename);
	if (cached) {
		return { bytes: cached, contentType: "image/webp", fresh: false };
	}

	const res = await fetch(personPhotoUrlFor(photoPath));
	if (!res.ok) throw new Error("Person photo download failed");
	const source = Buffer.from(await res.arrayBuffer());
	const sourceContentType = res.headers.get("content-type") || "image/jpeg";

	after(async () => {
		await dedupeEncode(`${PERSON_PHOTO_DIR}/${filename}`, async () => {
			const encoded = await sharp(source)
				.resize({ width: PERSON_PHOTO_MAX_WIDTH, withoutEnlargement: true })
				.webp({ quality: PERSON_PHOTO_QUALITY })
				.toBuffer();
			await storage.write(PERSON_PHOTO_DIR, filename, encoded);
			return encoded;
		});
	});

	return { bytes: source, contentType: sourceContentType, fresh: true };
}

// Same content-addressable caching as resolveChangelogPosterThumb, but for a
// change log entry's old/new bannerPath.
export async function resolveChangelogBannerThumb(
	mediaId: number,
	type: MediaType,
	bannerPath: string,
) {
	const filename = mediaAssetFilename(mediaId, bannerPath);
	await cacheOrDownload(
		CHANGELOG_BANNER_THUMB_DIR,
		filename,
		bannerUrlFor(type, bannerPath),
		{ resize: { width: BANNER_THUMB_MAX_WIDTH } },
		50,
	);

	return getImageStorage().urlFor(CHANGELOG_BANNER_THUMB_DIR, filename);
}
