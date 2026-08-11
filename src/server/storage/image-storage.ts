import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { del, head, list as listBlobs, put } from "@vercel/blob";

// Every caller addresses a file by a logical {dir, filename} pair instead of
// a real filesystem path — dir is a slash-joined key like "posters/cache" or
// "cropped/poster-2-3", never request-derived (always one of the constants
// exported by poster-resolver.ts / image-crop-resolver.ts / etc). That's
// what lets the same call sites work unchanged against either backend below:
// local disk today, and (once implemented) Vercel Blob or another object
// store in production, chosen via IMAGE_STORAGE_DRIVER without touching a
// single resolver.
export interface ImageStorage {
	read(dir: string, filename: string): Promise<Buffer | null>;
	write(dir: string, filename: string, bytes: Buffer): Promise<void>;
	// Filenames only (not full keys) — matches what readdir gave the
	// maintenance scripts before this abstraction existed, so their own
	// "is this filename still valid" set-membership checks didn't need to
	// change shape.
	list(dir: string): Promise<string[]>;
	// Returns whether a file actually existed to remove — purge-deleted-
	// change-log.ts counts real removals, cleanup-posters.ts and
	// cleanup-cropped-images.ts both ignore it (they already know the file
	// exists, from a preceding list()).
	remove(dir: string, filename: string): Promise<boolean>;
	// null when the file doesn't exist — cleanup-cropped-images.ts's only
	// caller, to decide whether a listed file has aged past MAX_AGE_MS.
	statMtimeMs(dir: string, filename: string): Promise<number | null>;
	// The public URL a browser (or link-preview crawler) can fetch this file
	// from directly. Local storage serves straight out of Next's `public/`
	// dir; a real object-store backend would return that store's own CDN
	// URL instead — either way, this is the one thing every direct-URL
	// caller (resolveChangelogPosterThumb, saveListThumbnail, cropAndSave)
	// needs, so they never construct a URL string themselves.
	urlFor(dir: string, filename: string): string;
}

class LocalImageStorage implements ImageStorage {
	private absDir(dir: string): string {
		// turbopackIgnore: dir is always one of the fixed logical-dir
		// constants declared in poster-resolver.ts / image-crop-resolver.ts /
		// list-thumbnail-resolver.ts (never request-derived), so this can
		// never escape public/ — same trace-false-positive Turbopack flags on
		// the equivalent path.join in image-crop-resolver.ts's cropAndSave,
		// worked around the same way.
		return path.join(
			/* turbopackIgnore: true */ process.cwd(),
			"public",
			...dir.split("/"),
		);
	}

	async read(dir: string, filename: string): Promise<Buffer | null> {
		try {
			return await readFile(path.join(this.absDir(dir), filename));
		} catch {
			return null;
		}
	}

	async write(dir: string, filename: string, bytes: Buffer): Promise<void> {
		const absDir = this.absDir(dir);
		await mkdir(absDir, { recursive: true });
		await writeFile(path.join(absDir, filename), bytes);
	}

	async list(dir: string): Promise<string[]> {
		try {
			return await readdir(this.absDir(dir));
		} catch {
			return [];
		}
	}

	async remove(dir: string, filename: string): Promise<boolean> {
		try {
			await unlink(path.join(this.absDir(dir), filename));
			return true;
		} catch {
			return false;
		}
	}

	async statMtimeMs(dir: string, filename: string): Promise<number | null> {
		try {
			const info = await stat(path.join(this.absDir(dir), filename));
			return info.mtimeMs;
		} catch {
			return null;
		}
	}

	urlFor(dir: string, filename: string): string {
		return `/${dir}/${filename}`;
	}
}

// Token shape Vercel issues is "vercel_blob_rw_<storeId>_<secret>" — every
// public blob URL is deterministically `https://<storeId>.public.blob
// .vercel-storage.com/<pathname>`, which is what lets urlFor stay a plain
// sync string build (matching ImageStorage's contract) instead of needing a
// round trip. @vercel/blob parses this same way internally, but doesn't
// export the helper, so it's reproduced here rather than reached into via a
// private import path.
function parseBlobStoreId(token: string): string {
	const storeId = token.split("_")[3];
	if (!storeId) {
		throw new Error(
			'Malformed BLOB_READ_WRITE_TOKEN — expected the "vercel_blob_rw_<storeId>_<secret>" shape Vercel issues.',
		);
	}
	return storeId;
}

// Selected automatically whenever the app is running on Vercel (or
// explicitly via IMAGE_STORAGE_DRIVER=vercel-blob) — see getImageStorage's
// driver-selection comment below. Every cached asset here is
// public (posters/banners/crops/thumbnails all get served straight to
// browsers or link-preview crawlers), so every call uses access: "public"
// and addRandomSuffix: false — filenames are already content-addressed by
// the callers in poster-resolver.ts/image-crop-resolver.ts/etc, so a random
// suffix would only break the "same input -> same URL" property those rely
// on. allowOverwrite: true covers two racing requests both missing the same
// cache key and writing the same bytes back — not an error case, just a
// wasted duplicate upload either way.
class VercelBlobImageStorage implements ImageStorage {
	private requireToken(): string {
		const token = process.env.BLOB_READ_WRITE_TOKEN;
		if (!token) {
			throw new Error(
				"BLOB_READ_WRITE_TOKEN is not set — required when " +
					"IMAGE_STORAGE_DRIVER=vercel-blob. Connect a Blob store to this " +
					"Vercel project (or set the var locally) to use it.",
			);
		}
		return token;
	}

	private pathnameFor(dir: string, filename: string): string {
		return `${dir}/${filename}`;
	}

	async read(dir: string, filename: string): Promise<Buffer | null> {
		const token = this.requireToken();
		let blob: { url: string };
		try {
			blob = await head(this.pathnameFor(dir, filename), { token });
		} catch {
			return null;
		}
		const res = await fetch(blob.url);
		if (!res.ok) return null;
		return Buffer.from(await res.arrayBuffer());
	}

	async write(dir: string, filename: string, bytes: Buffer): Promise<void> {
		await put(this.pathnameFor(dir, filename), bytes, {
			access: "public",
			addRandomSuffix: false,
			allowOverwrite: true,
			token: this.requireToken(),
		});
	}

	async list(dir: string): Promise<string[]> {
		const token = this.requireToken();
		const prefix = `${dir}/`;
		const filenames: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await listBlobs(
				cursor ? { prefix, cursor, token } : { prefix, token },
			);
			for (const blob of page.blobs) {
				filenames.push(blob.pathname.slice(prefix.length));
			}
			cursor = page.hasMore ? page.cursor : undefined;
		} while (cursor);
		return filenames;
	}

	async remove(dir: string, filename: string): Promise<boolean> {
		const token = this.requireToken();
		const pathname = this.pathnameFor(dir, filename);
		try {
			await head(pathname, { token });
		} catch {
			return false;
		}
		await del(pathname, { token });
		return true;
	}

	async statMtimeMs(dir: string, filename: string): Promise<number | null> {
		try {
			const blob = await head(this.pathnameFor(dir, filename), {
				token: this.requireToken(),
			});
			return blob.uploadedAt.getTime();
		} catch {
			return null;
		}
	}

	urlFor(dir: string, filename: string): string {
		const storeId = parseBlobStoreId(this.requireToken());
		return `https://${storeId}.public.blob.vercel-storage.com/${this.pathnameFor(dir, filename)}`;
	}
}

// Cached rather than constructed per call — neither backend holds per-call
// state, so there's nothing to gain from a fresh instance each time, and a
// singleton means an unknown driver name fails once at first use instead of
// silently on every request thereafter.
let cached: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
	if (cached) return cached;

	// IMAGE_STORAGE_DRIVER, if set, always wins. Otherwise default by
	// environment: VERCEL is set to "1" automatically in every one of
	// Vercel's own environments (Production, Preview, and `vercel dev`) —
	// checking it here means there's nothing to remember to flip before a
	// deploy, only an explicit var to set if a project ever wants to
	// override the default (e.g. testing the blob driver from a local dev
	// machine, or running local storage in some future self-hosted
	// production deployment).
	const driver =
		process.env.IMAGE_STORAGE_DRIVER ??
		(process.env.VERCEL === "1" ? "vercel-blob" : "local");
	switch (driver) {
		case "local":
			cached = new LocalImageStorage();
			break;
		case "vercel-blob":
			cached = new VercelBlobImageStorage();
			break;
		default:
			throw new Error(
				`Unknown IMAGE_STORAGE_DRIVER "${driver}" — expected "local" or "vercel-blob".`,
			);
	}
	return cached;
}
