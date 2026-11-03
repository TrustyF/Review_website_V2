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
} from "@/server/resolvers/poster-resolver";
import { getImageStorage } from "@/server/storage/image-storage";

// Only re-derivable caches (never *_CROP_DIR/LIST_THUMBNAIL_DIR user content); safe to delete.
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

// Saved crops live in POSTER_CROP_DIR/BANNER_CROP_DIR, so every dir above is disposable. Media still
// on a pre-migration cropped/ URL has its only copy in these caches, so refuse until migrated.
async function assertCropsMigrated(): Promise<void> {
	const isCrop = { contains: "/cropped/" };
	const unmigrated = await db.media.count({
		where: { OR: [{ posterPath: isCrop }, { bannerPath: isCrop }] },
	});
	if (unmigrated > 0) {
		throw new Error(
			`${unmigrated} media still point at cropped/ URLs; run \`npm run migrate_saved_crops -- --apply\` first.`,
		);
	}
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

	await assertCropsMigrated();

	// Person photos aren't tied to a media type.
	const dirs = types
		? MEDIA_CACHE_DIRS
		: [...MEDIA_CACHE_DIRS, PERSON_PHOTO_DIR];

	let removed = 0;
	for (const dir of dirs) {
		const files = (await storage.list(dir)).filter(
			(file) => !mediaIds || mediaIds.has(file.split("-")[0] ?? ""),
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
