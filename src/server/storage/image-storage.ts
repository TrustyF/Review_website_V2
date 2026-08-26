import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// Every caller addresses a file by a logical {dir, filename} pair instead of
// a real filesystem path — dir is a slash-joined key like "posters/cache" or
// "cropped/poster-2-3", never request-derived (always one of the constants
// exported by poster-resolver.ts / image-crop-resolver.ts / etc). That's
// what lets the same call sites work unchanged against either backend below:
// local disk in dev, and Cloudflare R2 in production (see getImageStorage),
// without touching a single resolver.
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

// Selected in production by getImageStorage() below — Cloudflare R2 speaks the S3 API, so
// this reuses @aws-sdk/client-s3 rather than a Cloudflare-specific package.
// Every object here is public (posters/banners/crops/thumbnails all get
// served straight to browsers or link-preview crawlers) and filenames are
// already content-addressed by the callers in poster-resolver.ts/
// image-crop-resolver.ts/etc, so writes always pass a public-cacheable key
// and overwriting an existing key with identical bytes is expected, not an
// error.
class R2ImageStorage implements ImageStorage {
	private client: S3Client | null = null;

	private requireEnv(name: string): string {
		const value = process.env[name];
		if (!value) {
			throw new Error(
				`${name} is not set — required when running on Vercel. See ` +
					".env.example.",
			);
		}
		return value;
	}

	private getClient(): S3Client {
		if (this.client) return this.client;
		const accountId = this.requireEnv("R2_ACCOUNT_ID");
		this.client = new S3Client({
			region: "auto",
			endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: this.requireEnv("R2_ACCESS_KEY_ID"),
				secretAccessKey: this.requireEnv("R2_SECRET_ACCESS_KEY"),
			},
		});
		return this.client;
	}

	private get bucket(): string {
		return this.requireEnv("R2_BUCKET_NAME");
	}

	private keyFor(dir: string, filename: string): string {
		return `${dir}/${filename}`;
	}

	async read(dir: string, filename: string): Promise<Buffer | null> {
		try {
			const res = await this.getClient().send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: this.keyFor(dir, filename),
				}),
			);
			const bytes = await res.Body?.transformToByteArray();
			return bytes ? Buffer.from(bytes) : null;
		} catch {
			return null;
		}
	}

	async write(dir: string, filename: string, bytes: Buffer): Promise<void> {
		await this.getClient().send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: this.keyFor(dir, filename),
				Body: bytes,
			}),
		);
	}

	async list(dir: string): Promise<string[]> {
		const prefix = `${dir}/`;
		const filenames: string[] = [];
		let continuationToken: string | undefined;
		do {
			const page = await this.getClient().send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				}),
			);
			for (const object of page.Contents ?? []) {
				if (object.Key) filenames.push(object.Key.slice(prefix.length));
			}
			continuationToken = page.IsTruncated
				? page.NextContinuationToken
				: undefined;
		} while (continuationToken);
		return filenames;
	}

	async remove(dir: string, filename: string): Promise<boolean> {
		const key = this.keyFor(dir, filename);
		try {
			await this.getClient().send(
				new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
			);
		} catch {
			return false;
		}
		await this.getClient().send(
			new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
		);
		return true;
	}

	async statMtimeMs(dir: string, filename: string): Promise<number | null> {
		try {
			const res = await this.getClient().send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: this.keyFor(dir, filename),
				}),
			);
			return res.LastModified ? res.LastModified.getTime() : null;
		} catch {
			return null;
		}
	}

	urlFor(dir: string, filename: string): string {
		const base = this.requireEnv("R2_PUBLIC_URL").replace(/\/$/, "");
		return `${base}/${this.keyFor(dir, filename)}`;
	}
}

// Cached rather than constructed per call — neither backend holds per-call
// state, so there's nothing to gain from a fresh instance each time.
let cached: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
	if (cached) return cached;

	// Pinned to R2 in production, no env var to override it — VERCEL is set
	// to "1" automatically in every one of Vercel's own environments
	// (Production, Preview, and `vercel dev`), so this needs nothing to
	// remember to flip before a deploy. This used to be overridable via an
	// IMAGE_STORAGE_DRIVER env var (for a since-removed Vercel Blob backend,
	// and for testing R2 from a local machine); a stale value left over in
	// the Vercel project's env settings silently kept production writing to
	// Blob long after the code moved to R2, running up Blob's "Advanced
	// Operations" billing. Set R2_* env vars locally (see .env.example) to
	// exercise this path outside Vercel.
	cached =
		process.env.VERCEL === "1" ? new R2ImageStorage() : new LocalImageStorage();
	return cached;
}
