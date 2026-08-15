import { readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import sharp from "sharp";
import { after } from "next/server";
import { MediaType } from "@prisma/client";
import { getImageStorage } from "@/server/storage/image-storage";

// The change log thumbnail only ever displays at 46x69 CSS px (~138px tall
// at 2x DPI) — smallSourceUrlFor already asks each source for its smallest
// templated size, but ComicVine and manually-entered posters have no
// smaller variant to request (see sourceUrlFor) and can come back at full
// poster resolution. Re-encoding to this height regardless of source
// guarantees a small cached file either way, instead of only when the
// source happens to cooperate.
const THUMB_MAX_HEIGHT = 140;
// Largest a person photo renders at today is the credits page sidebar,
// 150px CSS width (300px at 2x DPI) — resizing TMDB's w300 source down to
// this before caching keeps the cached file close to what's actually
// displayed instead of a bigger crop nothing on site ever shows at full
// size. See resolvePersonPhoto. Exported for the same reason as
// BANNER_MAX_WIDTH/POSTER_QUALITY: so the compression dev tool can show
// "what production actually does today" instead of a number that could
// silently drift out of sync with this file.
export const PERSON_PHOTO_MAX_WIDTH = 300;
// Higher than POSTER_QUALITY: a person photo used to only ever render as a
// tiny 40px cast avatar (where compression artifacts were invisible
// anyway), but now renders up to 150px in the credits page sidebar — big
// enough that the old 50 started showing visible blockiness on faces. Own
// constant rather than reusing POSTER_QUALITY directly, same reasoning as
// before: a headshot and a poster are different enough content that they
// may not want to move together if either gets tuned again later. See
// resolvePersonPhoto.
export const PERSON_PHOTO_QUALITY = 50;
// The page's own content column tops out at 950px (see media-detail.module
// .sass .wrapper) — a banner never renders any wider than that, so caching
// TMDB's 1280px backdrops or IGDB's up-to-1920px artworks at full size was
// pure waste. Measured against 12 real banners: capping width alone (still
// at WEBP_QUALITY) cut total size 45%, the large majority of what's
// possible — quality has much less room to give without visibly softening
// an image shown this large. See resolveBanner.
// Exported (unlike the other size/quality constants here) so the banner
// compression dev tool can show "what production actually does today" as a
// baseline alongside whatever it's experimenting with, instead of a
// hardcoded number that could silently drift out of sync with this file.
export const BANNER_MAX_WIDTH = 1280;
// avif/60 tuned in the banner compression dev tool (/dev/banner-compression)
// against real TMDB/IGDB banners — meaningfully smaller than webp at a
// quality where the difference isn't visible at the size a banner actually
// renders. Changing either requires updating every place that assumes
// BANNER_FORMAT's extension: mediaAssetFilename's "avif" argument in
// types.ts (bannerSrc) and cleanup-posters.ts (orphan filenames), and the
// Content-Type in the /api/banner route — all four have to agree on what's
// actually on disk.
export const BANNER_FORMAT = "avif";
export const BANNER_QUALITY = 60;
// Decorative only — a CSS mix-blend-mode overlay applied where a banner is
// actually displayed (see BannerEditTrigger's .grain), never baked into the
// cached file itself. Sharing this constant with the compression dev tool's
// default just keeps "what production does" accurate there too; the
// playground's grain slider still isn't part of what gets encoded to disk.
export const BANNER_GRAIN_OPACITY = 0.5;
// Change log rows show a small landscape thumbnail for a bannerPath change,
// the same idea as THUMB_MAX_HEIGHT for posterPath — sized down from
// BANNER_MAX_WIDTH the same way THUMB_MAX_HEIGHT is sized down from the full
// poster. See resolveChangelogBannerThumb.
const BANNER_THUMB_MAX_WIDTH = 120;
// The main poster cache re-encodes to WebP at this quality and keeps the
// source's own dimensions — it's the one cached asset here that's deliberately
// never resized down, unlike the thumbnail and banner. Exported for the same
// reason as the BANNER_* constants: so the compression dev tool can show
// this as a baseline instead of a number that could drift out of sync.
export const POSTER_QUALITY = 50;
// The change log thumbnail cache re-encodes to WebP at its own lower
// quality — see resolveChangelogPosterThumb.

// Every *_DIR constant below is a logical key handed to ImageStorage, not a
// real filesystem path — see src/server/storage/image-storage.ts. Local
// storage joins it onto public/ itself; a remote backend would use it as a
// key prefix instead.
export const POSTER_DIR = "posters/cache";

// Separate from POSTER_DIR: change log thumbnails are deliberately the
// smallest size each source offers (see smallSourceUrlFor) rather than the
// main poster's w500-equivalent, so they get their own cache directory
// instead of colliding on the same filename with a different-sized file.
export const CHANGELOG_THUMB_DIR = "posters/changelog-cache";

// Separate again from the two above: banners are a different asset (wide
// backdrop/artwork, not a poster) with their own cache, even though they
// share every other bit of machinery in this file.
export const BANNER_DIR = "banners/cache";

// Change log's own banner thumbnail cache — same reasoning as
// CHANGELOG_THUMB_DIR vs POSTER_DIR: a different size than BANNER_DIR, own
// directory rather than risk colliding on a same-hash-different-size file.
export const CHANGELOG_BANNER_THUMB_DIR = "banners/changelog-cache";

// Cast headshot cache — keyed by personId rather than mediaId (nothing about
// mediaAssetFilename's numeric-prefix-plus-hash scheme is actually
// media-specific), since a person's photo is the same asset across every
// media they're credited on.
export const PERSON_PHOTO_DIR = "people/photo-cache";

// A JPEG-specific cache purely for the og:image tag a shared link's preview
// card reads (see resolveLinkEmbedImage) — separate from POSTER_DIR because
// the main poster cache is deliberately WebP (smaller, and every on-site
// caller already supports it), but Discord and WhatsApp's link-preview
// crawlers (the latter shares Meta's scraper) have long-standing,
// well-documented unreliability rendering WebP for og:image, reliable only
// with JPEG/PNG. Its own directory rather than writing JPEGs into
// POSTER_DIR alongside the WebP files — different format/size/quality
// settings (below) means it isn't the same asset the rest of the site
// wants, just derived from the same source.
export const LINK_EMBED_DIR = "posters/link-embed-cache";
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

type CacheFormat = "webp" | "avif" | "jpeg";

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

// Content-addressable: the filename is derived from the source path itself
// (posterPath or bannerPath), so switching a media's poster/banner naturally
// produces a different filename/URL — no cache-busting query string or
// manual invalidation needed. Old files from a previous path become
// orphaned; see poster-cleanup.ts (main posters) and
// purge-deleted-change-log.ts (change log thumbnails).
// extension must match whatever cacheOrDownload actually encoded to for
// that asset (see BANNER_FORMAT) — every caller of this function is
// independently guessing the filename an earlier resolve*/cache write
// produced, not reading it off disk.
export function mediaAssetFilename(
	mediaId: number,
	assetPath: string,
	extension: CacheFormat = "webp",
) {
	const hash = createHash("sha256")
		.update(assetPath)
		.digest("hex")
		.slice(0, 12);
	return `${mediaId}-${hash}.${extension}`;
}

// The lazy-resolve poster URL for a media item — points at /api/poster,
// which does the actual resolve-or-download the moment something requests
// it (see that route), or the static placeholder when there's no poster at
// all. Was copy-pasted identically in list-actions.ts's searchMediaForList
// and search-actions.ts's searchAllMedia; both build search results shaped
// around a MediaRecord-like {id, posterPath}, so this is the one place that
// ternary needs to live.
export function toPosterSrc(mediaId: number, posterPath: string | null) {
	return posterPath
		? `/api/poster/${mediaId}/${mediaAssetFilename(mediaId, posterPath)}`
		: "/posters/placeholder.jpg";
}

export type PosterSize = "thumb" | "full";

// The one place that knows how to turn a stored posterPath into an actual
// CDN URL — used for the main poster cache, the change log thumbnail cache,
// the editor's alternate-poster picker, and add-media's search-result
// thumbnails, so a source's URL template only ever needs to change here.
//
// Each source stores posterPath differently: TMDB's is a path segment
// appended to its image CDN, MangaDex's is just a cover filename that needs
// the manga's own id (externalId) to locate on its upload host, IGDB's is an
// image_id that slots into its own CDN path template. ComicVine and manually
// entered posters (see manual-add-actions.ts) are already full URLs, with
// nothing left to template — checked first, ahead of and independent of
// type, since a manual entry can be any MediaType.
//
// "thumb" vs "full" only matters for the three templated sources — a
// ComicVine/manual posterPath is a fixed URL either way. Callers that want a
// smaller size than "thumb" gives (e.g. the change log's 46x69 display) rely
// on resolveChangelogPosterThumb's own resize instead of a third tier here.
export function posterUrlFor(
	type: MediaType,
	externalId: string | null,
	posterPath: string,
	size: PosterSize,
) {
	if (posterPath.startsWith("http://") || posterPath.startsWith("https://")) {
		return posterPath;
	}
	if (type === MediaType.MANGA) {
		// .512.jpg is MangaDex's downsized thumbnail rather than the
		// full-resolution scan (often several MB); .256.jpg is smaller still.
		return `https://uploads.mangadex.org/covers/${externalId}/${posterPath}.${size === "full" ? "512" : "256"}.jpg`;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_cover_${size === "full" ? "big" : "small"}/${posterPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/${size === "full" ? "w500" : "w154"}${posterPath}`;
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

// The composite depends on both the poster and (when there is one) the
// banner, so both need to be part of the content-address — shared between
// toLinkEmbedImageSrc and resolveLinkEmbedImage so they can never compute
// different filenames for the same inputs.
function linkEmbedCacheKey(posterPath: string, bannerPath: string | null) {
	return `${posterPath}::${bannerPath ?? ""}`;
}

// The lazy-resolve URL counterpart to resolveLinkEmbedImage, same shape as
// toPosterSrc — points at /api/link-embed, which resolves-or-downloads the
// moment a link-preview crawler actually requests it. Returns null (not a
// placeholder) when there's no real poster — a generic placeholder image on
// a preview card would misrepresent the title rather than just show nothing.
export function toLinkEmbedImageSrc(
	mediaId: number,
	posterPath: string | null,
	bannerPath: string | null,
) {
	return posterPath
		? `/api/link-embed/${mediaId}/${mediaAssetFilename(mediaId, linkEmbedCacheKey(posterPath, bannerPath), "jpeg")}`
		: null;
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

// Only TMDB (backdrop_path) and IGDB (artworks) have a wide banner asset at
// all — MangaDex/ComicVine/manual entries never populate Media.bannerPath in
// the first place (see the ingest files), so this never actually needs to
// handle those. No externalId parameter: unlike posterUrlFor, neither TMDB's
// backdrop_path nor IGDB's artwork image_id need scoping context to locate.
export function bannerUrlFor(type: MediaType, bannerPath: string) {
	if (bannerPath.startsWith("http://") || bannerPath.startsWith("https://")) {
		return bannerPath;
	}
	if (type === MediaType.GAME) {
		return `https://images.igdb.com/igdb/image/upload/t_1080p/${bannerPath}.jpg`;
	}
	return `https://image.tmdb.org/t/p/w1280${bannerPath}`;
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

// Only TMDB cast credits ever populate Person.photoPath (see
// movie-credits.ts/tv-show-credits.ts and Person.photoPath's own comment) —
// no per-source branching needed, same as companyLogoUrlFor. w300 is TMDB's
// next profile size up from w185 — needed so resolvePersonPhoto's own
// resize to PERSON_PHOTO_MAX_WIDTH (300) isn't just upscaling an
// already-too-small source.
export function personPhotoUrlFor(photoPath: string): string {
	if (photoPath.startsWith("http://") || photoPath.startsWith("https://")) {
		return photoPath;
	}
	return `https://image.tmdb.org/t/p/w300${photoPath}`;
}

// The lazy-resolve URL counterpart to resolvePersonPhoto, same shape as
// toPosterSrc — points at /api/person-photo, which resolves-or-downloads the
// moment a browser actually requests it. Returns null (not a placeholder)
// when there's no photo — CastPhotos falls back to a plain text link in that
// case rather than rendering a generic avatar.
export function toPersonPhotoSrc(personId: number, photoPath: string | null) {
	return photoPath
		? `/api/person-photo/${personId}/${mediaAssetFilename(personId, photoPath)}`
		: null;
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
