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
	linkEmbedCacheKey,
	mediaAssetFilename,
	personPhotoUrlFor,
	posterUrlFor,
	type CacheFormat,
} from "@/server/resolvers/asset-paths";

// Re-exported so existing callers that only need the pure URL/filename
// helpers (no `sharp` dependency) can keep importing from this file — new
// perf-sensitive callers (server actions on a hot path, like search) should
// import straight from asset-paths.ts instead, so their bundle doesn't pull
// in sharp's native binary just to build a URL. See asset-paths.ts's own
// comment for the full story.
export * from "@/server/resolvers/asset-paths";

// The change log thumbnail only ever displays at 46x69 CSS px (~138px tall
// at 2x DPI) — smallSourceUrlFor already asks each source for its smallest
// templated size, but ComicVine and manually-entered posters have no
// smaller variant to request (see sourceUrlFor) and can come back at full
// poster resolution. Re-encoding to this height regardless of source
// guarantees a small cached file either way, instead of only when the
// source happens to cooperate.
const THUMB_MAX_HEIGHT = 140;
// Change log rows show a small landscape thumbnail for a bannerPath change,
// the same idea as THUMB_MAX_HEIGHT for posterPath — sized down from
// BANNER_MAX_WIDTH the same way THUMB_MAX_HEIGHT is sized down from the full
// poster. See resolveChangelogBannerThumb.
const BANNER_THUMB_MAX_WIDTH = 120;
// The change log thumbnail cache re-encodes to WebP at its own lower
// quality — see resolveChangelogPosterThumb.

// 1200x630 (~1.91:1) is the de facto standard og:image shape — the one
// dimension both Discord and WhatsApp render consistently as a clean
// rectangle. A poster's own 2:3 (or 3:4) crop doesn't fit that box, and
// WhatsApp's link-preview UI force-crops non-matching shapes into a square
// no matter what metadata says (client-side behavior, not something a
// publisher can override) — see resolveLinkEmbedImage for how this actually
// gets composited into that box instead of just resized into it.
const LINK_EMBED_WIDTH = 1200;
const LINK_EMBED_HEIGHT = 630;
// Height of the poster "card" composited on top of the backdrop, border
// included — leaves a little backdrop visible above/below on the 630-tall
// canvas. Width follows whatever a given poster's own ratio produces at
// this height (2:3 for most types, 3:4 for comic/game) rather than a second
// fixed number.
const LINK_EMBED_POSTER_HEIGHT = 540;
const LINK_EMBED_POSTER_BORDER = 6;
// Not measured in the compression dev tool the way POSTER_QUALITY/
// BANNER_QUALITY were — JPEG generally needs a higher quality number than
// WebP/AVIF for comparable visual fidelity, so this is deliberately well
// above POSTER_QUALITY's 50 rather than reused from it.
const LINK_EMBED_QUALITY = 60;

// Keyed by "dir/filename", so a resize/encode that's already running for a
// given cache miss is reused instead of redone. Without this, several
// concurrent requests for the same not-yet-cached asset (e.g. a handful of
// tabs open on a title right after it's added, before anyone's request has
// finished writing the cache) would each independently download, sharp-
// encode, and storage.write the identical bytes — real duplicated Active CPU
// for work whose result only ever needs computing once. Module-scope, so it
// only dedupes concurrent requests landing on the same warm instance — which
// is exactly the case Fluid's higher per-instance concurrency makes more
// likely, not less.
const inFlightEncodes = new Map<string, Promise<Buffer>>();

function dedupeEncode(key: string, run: () => Promise<Buffer>): Promise<Buffer> {
	const existing = inFlightEncodes.get(key);
	if (existing) return existing;
	const promise = run().finally(() => inFlightEncodes.delete(key));
	inFlightEncodes.set(key, promise);
	return promise;
}

// Shared by resolvePoster, resolveChangelogPosterThumb, and resolveBanner:
// content-addressed cache-or-download, differing only in directory, which
// size URL to fetch, and whether/how the downloaded bytes get resized down
// before being written — all three re-encode to WebP.
//
// Goes through ImageStorage (see src/server/storage/image-storage.ts)
// rather than fs directly, so this works unchanged against local disk today
// or a remote object store in production — the only thing that differs
// between backends is where read/write actually land.
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

// bytes typed as the plain Uint8Array rather than Node's own generic
// Buffer<ArrayBufferLike> — the two are structurally the same at runtime
// (Buffer extends Uint8Array), but NextResponse's BodyInit type doesn't
// resolve against the generic Buffer type cleanly, only the plain one.
export type ResolvedAsset = { bytes: Uint8Array; contentType: string };

const PLACEHOLDER_POSTER_PATH = path.join(
	process.cwd(),
	"public",
	"posters",
	"placeholder.jpg",
);

// Returns the actual bytes (not a URL) — the /api/poster route hands these
// straight back as the response body. Same fresh-miss/awaitEncode shape as
// resolveBanner (see that function's own comment): on a cache miss, the raw
// downloaded source is returned immediately and the resize/encode/storage
// write happens in `after()`, off the response's critical path, so the
// browser isn't blocked on sharp for a first-time poster the way it used to
// be. updateMediaPoster (media-editor-actions.ts) still wants the opposite
// trade — the cache warm *before* it returns — so it passes
// `{ awaitEncode: true }` instead.
export async function resolvePoster(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string | null,
	{ awaitEncode = false }: { awaitEncode?: boolean } = {},
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

	// Posters are deliberately never resized down (see POSTER_QUALITY's own
	// comment) — just re-encoded to WebP, unlike person photos/banners.
	const encode = () =>
		dedupeEncode(`${POSTER_DIR}/${filename}`, async () => {
			const encoded = await sharp(source).webp({ quality: POSTER_QUALITY }).toBuffer();
			await storage.write(POSTER_DIR, filename, encoded);
			return encoded;
		});

	if (awaitEncode) {
		await encode();
	} else {
		after(async () => {
			await encode();
		});
	}

	return { bytes: source, contentType: sourceContentType, fresh: true };
}

async function fetchImageBytes(url: string): Promise<Buffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	return Buffer.from(await res.arrayBuffer());
}

// Composites a standard-shaped (1200x630) link-preview image instead of
// just resizing the poster into that box — see LINK_EMBED_WIDTH's own
// comment on why a plain resize/crop doesn't work here. A real banner
// (TMDB backdrop / IGDB artwork) makes a much better backdrop than a
// blurred-up poster when one exists; manga/comic never have one (see
// bannerUrlFor's own note on that), and even TMDB/IGDB titles sometimes
// lack one, so this falls back to blurring the poster itself either way.
// Doesn't share cacheOrDownload's shape — that helper assumes one source
// image and one resize, this needs up to two sources and a composite.
export async function resolveLinkEmbedImage(
	mediaId: number,
	type: MediaType,
	externalId: string | null,
	posterPath: string | null,
	bannerPath: string | null,
): Promise<ResolvedAsset | null> {
	if (!posterPath) return null;

	const filename = mediaAssetFilename(
		mediaId,
		linkEmbedCacheKey(posterPath, bannerPath),
		"jpeg",
	);
	const storage = getImageStorage();

	const cached = await storage.read(LINK_EMBED_DIR, filename);
	if (cached) return { bytes: cached, contentType: "image/jpeg" };

	const bytes = await dedupeEncode(`${LINK_EMBED_DIR}/${filename}`, async () => {
		const posterBytes = await fetchImageBytes(
			posterUrlFor(type, externalId, posterPath, "full"),
		);

		let backgroundBytes = posterBytes;
		if (bannerPath) {
			try {
				backgroundBytes = await fetchImageBytes(bannerUrlFor(type, bannerPath));
			} catch {
				// Falls back to the poster itself (still assigned above) — a
				// broken/unreachable banner shouldn't block the whole embed image.
			}
		}
		const isBlurredPosterBackdrop = backgroundBytes === posterBytes;

		let background = sharp(backgroundBytes).resize({
			width: LINK_EMBED_WIDTH,
			height: LINK_EMBED_HEIGHT,
			fit: "cover",
		});
		if (isBlurredPosterBackdrop) {
			background = background.blur(24);
		}

		// Darkens the backdrop either way — keeps the poster card readable
		// against a bright banner/poster, same idea as the detail page's own
		// banner gradient (see media-detail.module.sass's .banner_backdrop).
		const scrim = Buffer.from(
			`<svg width="${LINK_EMBED_WIDTH}" height="${LINK_EMBED_HEIGHT}"><rect width="100%" height="100%" fill="black" fill-opacity="0.35"/></svg>`,
		);

		// A thin solid border gives the poster a "card" edge against the
		// backdrop instead of just floating with nothing to define it.
		const posterCard = await sharp(posterBytes)
			.resize({
				height: LINK_EMBED_POSTER_HEIGHT - LINK_EMBED_POSTER_BORDER * 2,
				withoutEnlargement: true,
			})
			.extend({
				top: LINK_EMBED_POSTER_BORDER,
				bottom: LINK_EMBED_POSTER_BORDER,
				left: LINK_EMBED_POSTER_BORDER,
				right: LINK_EMBED_POSTER_BORDER,
				background: "#ffffff",
			})
			.png()
			.toBuffer();

		const bytes = await background
			.composite([{ input: scrim }, { input: posterCard, gravity: "center" }])
			.jpeg({ quality: LINK_EMBED_QUALITY })
			.toBuffer();

		await storage.write(LINK_EMBED_DIR, filename, bytes);
		return bytes;
	});
	return { bytes, contentType: "image/jpeg" };
}

// Same content-addressable caching as resolvePoster, but for a change log
// entry's old/new posterPath — mediaId + posterPath alone is enough to
// address it, so a poster that's since been replaced (or a media that's
// since been deleted) still resolves to its own stable historical file.
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

// Doesn't share cacheOrDownload's shape — a banner source (TMDB w1280
// backdrop / IGDB t_1080p artwork) is large enough that the resize + AVIF
// re-encode is the slow part of a cache miss, not the download. Blocking the
// very first viewer of a given banner on that encode (plus the storage
// write, itself a network round trip on the Blob backend) is what made a
// first-time banner load noticeably slow on Vercel. Instead, a miss returns
// the raw source bytes immediately and does the resize/encode/write in
// `after()`, off the request's critical path — the next request for this
// banner finds it cached (see the `fresh` flag below) and gets the small,
// long-lived-cacheable AVIF.
export async function resolveBanner(
	mediaId: number,
	type: MediaType,
	bannerPath: string | null,
	// media-editor-actions.ts's save handler wants the opposite trade-off:
	// it's not racing a browser for a fast first byte, and its whole point in
	// calling this at all is to have the cache warm *before* it returns, so
	// it awaits the encode inline instead of deferring it.
	{ awaitEncode = false }: { awaitEncode?: boolean } = {},
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
	// TMDB backdrops and IGDB artworks are both plain JPEGs, but reading it
	// off the response rather than hardcoding "image/jpeg" costs nothing and
	// stays correct if either source ever changes format.
	const sourceContentType = res.headers.get("content-type") || "image/jpeg";

	// Deduped for the same reason as cacheOrDownload/resolveLinkEmbedImage:
	// several concurrent misses on this banner (e.g. `after()`-deferred
	// encodes from more than one first-time viewer, or one racing an
	// awaitEncode caller) would otherwise each redo the resize/encode/write.
	const encode = () =>
		dedupeEncode(`${BANNER_DIR}/${filename}`, async () => {
			const encoded = await sharp(source)
				.resize({ width: BANNER_MAX_WIDTH, withoutEnlargement: true })
				.avif({ quality: BANNER_QUALITY })
				.toBuffer();
			await storage.write(BANNER_DIR, filename, encoded);
			return encoded;
		});

	if (awaitEncode) {
		await encode();
	} else {
		after(async () => {
			await encode();
		});
	}

	return { bytes: source, contentType: sourceContentType, fresh: true };
}

// Same fresh-miss/deferred-encode shape as resolvePoster/resolveBanner — see
// resolvePoster's own comment — just a smaller resize target (see
// PERSON_PHOTO_MAX_WIDTH) and no placeholder fallback, since callers only
// ever reach this once toPersonPhotoSrc has already confirmed there's a
// photoPath to resolve. No awaitEncode option — unlike poster/banner, no
// caller needs the cache warmed before it returns.
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
