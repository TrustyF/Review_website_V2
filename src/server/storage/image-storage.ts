import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";

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

const NOT_IMPLEMENTED =
	"IMAGE_STORAGE_DRIVER=vercel-blob is not implemented yet — this is a " +
	"placeholder so the driver name is already wired up end-to-end. Fill in " +
	"each method using @vercel/blob's put/list/del/head once that package is " +
	"added, and point urlFor at the store's own public URL shape instead of " +
	"a local /-prefixed path (next.config.ts's images.localPatterns will " +
	"also need a matching remotePatterns entry for that host).";

// Selected by IMAGE_STORAGE_DRIVER=vercel-blob. Every method throws rather
// than silently falling back to acting like local storage — a misconfigured
// driver name should fail loudly at first use, not quietly write cache files
// nobody can find.
class VercelBlobImageStorage implements ImageStorage {
	read(): Promise<Buffer | null> {
		throw new Error(NOT_IMPLEMENTED);
	}
	write(): Promise<void> {
		throw new Error(NOT_IMPLEMENTED);
	}
	list(): Promise<string[]> {
		throw new Error(NOT_IMPLEMENTED);
	}
	remove(): Promise<boolean> {
		throw new Error(NOT_IMPLEMENTED);
	}
	statMtimeMs(): Promise<number | null> {
		throw new Error(NOT_IMPLEMENTED);
	}
	urlFor(): string {
		throw new Error(NOT_IMPLEMENTED);
	}
}

// Cached rather than constructed per call — neither backend holds per-call
// state, so there's nothing to gain from a fresh instance each time, and a
// singleton means an unknown driver name fails once at first use instead of
// silently on every request thereafter.
let cached: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
	if (cached) return cached;

	const driver = process.env.IMAGE_STORAGE_DRIVER ?? "local";
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
