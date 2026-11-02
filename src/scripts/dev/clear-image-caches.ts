import { rm } from "fs/promises";
import path from "path";
import { MediaType } from "@prisma/client";
import { db } from "@/server/db/client";
import {
	POSTER_DIR,
	CHANGELOG_THUMB_DIR,
	BANNER_DIR,
	BANNER_MOBILE_DIR,
	CHANGELOG_BANNER_THUMB_DIR,
	PERSON_PHOTO_DIR,
	LINK_EMBED_DIR,
	mediaAssetFilename,
} from "@/server/resolvers/poster-resolver";
import { getImageStorage } from "@/server/storage/image-storage";

// Only re-derivable caches (never CROPPED_DIR/LIST_THUMBNAIL_DIR's user content); safe to delete.
// Files are named `${mediaId}-${hash}.ext` (mediaAssetFilename), so --type filters by id prefix.
const MEDIA_CACHE_DIRS = [
	POSTER_DIR,
	CHANGELOG_THUMB_DIR,
	BANNER_DIR,
	BANNER_MOBILE_DIR,
	CHANGELOG_BANNER_THUMB_DIR,
	LINK_EMBED_DIR,
];

// Usage: npm run clear_image_caches [-- --type game,movie]
function parseTypes(argv: string[]): MediaType[] | null {
	const i = argv.indexOf("--type");
	if (i === -1) return null;
	const raw = argv[i + 1];
	if (!raw) throw new Error("--type needs a value, e.g. --type game");
	const valid = Object.values(MediaType);
	return raw.split(",").map((t) => {
		const type = t.trim().toUpperCase() as MediaType;
		if (!valid.includes(type)) {
			throw new Error(`Unknown type "${t}". Valid: ${valid.join(", ")}`);
		}
		return type;
	});
}

// A saved crop's only durable copy is its poster/banner cache file (CROPPED_DIR is swept
// after 24h), so those files and anything derived from them must never be deleted.
async function findCropDerivedKeys(): Promise<Set<string>> {
	const isCrop = { contains: "/cropped/" };
	const [media, changes] = await Promise.all([
		db.media.findMany({
			where: { OR: [{ posterPath: isCrop }, { bannerPath: isCrop }] },
			select: { id: true, posterPath: true, bannerPath: true },
		}),
		db.mediaChangeLog.findMany({
			where: { OR: [{ oldValue: isCrop }, { newValue: isCrop }] },
			select: { mediaId: true, oldValue: true, newValue: true },
		}),
	]);
	const pairs = [
		...media.flatMap((m) => [
			[m.id, m.posterPath],
			[m.id, m.bannerPath],
		]),
		...changes.flatMap((c) => [
			[c.mediaId, c.oldValue],
			[c.mediaId, c.newValue],
		]),
	] as [number, string | null][];
	// Extension stripped: the same crop is cached as webp/avif/jpeg across dirs.
	return new Set(
		pairs
			.filter(([, p]) => p?.includes("/cropped/"))
			.map(([id, p]) => mediaAssetFilename(id, p!).replace(/\.[^.]+$/, "")),
	);
}

// Dev-only: lets a resize/quality/format change in poster-resolver.ts take effect —
// cache files are keyed by source URL, not encode settings, so a stale file lingers otherwise.
async function main() {
	const types = parseTypes(process.argv.slice(2));
	const storage = getImageStorage();

	// db, not dbPublic: soft-deleted media can still have cached files.
	const mediaIds = types
		? new Set(
				(
					await db.media.findMany({
						where: { type: { in: types } },
						select: { id: true },
					})
				).map((m) => String(m.id)),
			)
		: null;
	if (types)
		console.log(`Only ${types.join(", ")} (${mediaIds!.size} media)\n`);

	const protectedKeys = await findCropDerivedKeys();
	console.log(
		`Keeping files derived from ${protectedKeys.size} saved crop(s)\n`,
	);

	// Person photos aren't tied to a media type.
	const dirs = types
		? MEDIA_CACHE_DIRS
		: [...MEDIA_CACHE_DIRS, PERSON_PHOTO_DIR];

	let removed = 0;
	for (const dir of dirs) {
		const files = (await storage.list(dir)).filter(
			(file) =>
				(!mediaIds || mediaIds.has(file.split("-")[0] ?? "")) &&
				!protectedKeys.has(file.replace(/\.[^.]+$/, "")),
		);
		let dirRemoved = 0;
		for (const file of files) {
			if (await storage.remove(dir, file)) dirRemoved++;
		}
		removed += dirRemoved;
		console.log(`${dir}: removed ${dirRemoved} file(s)`);
	}

	if (!types) {
		// Next's optimizer cache — currently kept empty by images.unoptimized, but harmless to clear.
		// turbopackIgnore: process.cwd()-relative, never request-derived.
		const nextImageCache = path.join(
			/* turbopackIgnore: true */ process.cwd(),
			".next/cache/images",
		);
		await rm(nextImageCache, { recursive: true, force: true });
		console.log(`.next/cache/images: cleared`);
	}

	console.log(`\nRemoved ${removed} cached image file(s) total.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
