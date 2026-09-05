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

// Logical {dir, filename} pairs let same resolvers work against disk (dev) or R2 (prod)
export interface ImageStorage {
	read(dir: string, filename: string): Promise<Buffer | null>;
	write(dir: string, filename: string, bytes: Buffer): Promise<void>;
	// Filenames only (not full keys) — matches what readdir gave maintenance scripts before abstraction, so set-membership checks didn't need shape change.
	list(dir: string): Promise<string[]>;
	// Returns whether file existed; cleanup scripts use or ignore.
	remove(dir: string, filename: string): Promise<boolean>;
	// null when the file doesn't exist — cleanup-cropped-images.ts's only
	// caller, to decide whether a listed file has aged past MAX_AGE_MS.
	statMtimeMs(dir: string, filename: string): Promise<number | null>;
	// Public URL for browsers/crawlers; unified place so callers don't construct URLs.
	urlFor(dir: string, filename: string): string;
}

class LocalImageStorage implements ImageStorage {
	private absDir(dir: string): string {
		// turbopackIgnore: dir is always a fixed logical constant, never request-derived
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

// Selected in production by getImageStorage() — Cloudflare R2 speaks S3 API. Every object public; filenames content-addressed by callers, so overwriting with identical bytes is expected.
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

	// R2 opt-in only (IMAGE_STORAGE_DRIVER=r2); default local disk
	// prevents stray builds from hitting real bucket.
	cached =
		process.env.IMAGE_STORAGE_DRIVER === "r2"
			? new R2ImageStorage()
			: new LocalImageStorage();
	return cached;
}

	// Cached separately, always local disk; app is long-lived container now.
	// Local file outlives what actually needs it (not Vercel cold-start issue).
let cachedLocal: ImageStorage | null = null;

export function getLocalDiskStorage(): ImageStorage {
	if (!cachedLocal) cachedLocal = new LocalImageStorage();
	return cachedLocal;
}
