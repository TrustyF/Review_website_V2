import { db } from "@/server/db/client";
import { getImageStorage } from "@/server/storage/image-storage";
import {
	BANNER_CROP_DIR,
	BANNER_DIR,
	BANNER_FORMAT,
	POSTER_CROP_DIR,
	POSTER_DIR,
	mediaAssetFilename,
	persistCroppedBanner,
	persistCroppedPoster,
} from "@/server/resolvers/poster-resolver";
import { readCroppedFile } from "@/server/resolvers/image-crop-resolver";
import { cropExtension, saveCrop } from "@/server/resolvers/saved-crop";

// One-off, dry run unless --apply: moves crops still referenced by cropped/ URL into *_CROP_DIR.
// Bytes come from the poster/banner cache file (crops were stored there as-is), else cropped/.
async function main() {
	const apply = process.argv.includes("--apply");
	const storage = getImageStorage();
	const isCrop = { contains: "/cropped/" };
	const media = await db.media.findMany({
		where: { OR: [{ posterPath: isCrop }, { bannerPath: isCrop }] },
		select: {
			id: true,
			title: true,
			type: true,
			posterPath: true,
			bannerPath: true,
		},
		orderBy: { id: "asc" },
	});

	const counts = { migrated: 0, lost: 0 };
	for (const m of media) {
		const fields = [
			{
				field: "posterPath",
				path: m.posterPath,
				cacheDir: POSTER_DIR,
				ext: "webp",
				cropDir: POSTER_CROP_DIR,
			},
			{
				field: "bannerPath",
				path: m.bannerPath,
				cacheDir: BANNER_DIR,
				ext: BANNER_FORMAT,
				cropDir: BANNER_CROP_DIR,
			},
		] as const;
		for (const { field, path, cacheDir, ext, cropDir } of fields) {
			if (!path?.includes("/cropped/")) continue;
			const label = `#${m.id} ${m.type} ${field}  ${m.title}`;
			const bytes =
				(await storage.read(cacheDir, mediaAssetFilename(m.id, path, ext))) ??
				(await readCroppedFile(path));
			if (!bytes) {
				counts.lost++;
				console.log(
					`LOST     ${label}  (no cache file or temp copy: re-crop in the editor)`,
				);
				continue;
			}
			if (!apply) {
				console.log(`WOULD    ${label}`);
				continue;
			}
			const savedPath = await saveCrop(cropDir, bytes, cropExtension(path));
			// No change log entry: same image, only its storage location moved.
			await db.media.update({
				where: { id: m.id },
				data: { [field]: savedPath },
			});
			if (field === "posterPath")
				await persistCroppedPoster(m.id, savedPath, bytes);
			else await persistCroppedBanner(m.id, savedPath, bytes);
			counts.migrated++;
			console.log(`MIGRATED ${label}  -> ${savedPath}`);
		}
	}

	console.log(
		`\n${media.length} media with cropped/ paths; ${apply ? `${counts.migrated} migrated` : "dry run (pass --apply to migrate)"}, ${counts.lost} lost.`,
	);
}

main().then(
	() => process.exit(0),
	(e) => {
		console.error(e);
		process.exit(1);
	},
);
