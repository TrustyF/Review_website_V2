import { readdir, rm, stat } from "fs/promises";
import path from "path";

const CROPPED_ROOT = path.join(process.cwd(), "public", "cropped");

// Unlike cleanup-posters.ts/purge-deleted-change-log.ts, nothing in the DB
// ever references a /cropped/... path directly — a promoted file has
// already been copied into its real destination (see list-actions.ts's
// resolveThumbnailUrl) by the time anything durable points at it, so
// there's no "orphan" check to make here, only age. 24h is a generous
// grace period: long enough to crop something, step away, and come back
// later the same day to paste it in.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Safe to re-run any time / on a schedule.
async function main() {
	const shapeDirs = await readdir(CROPPED_ROOT).catch(() => []);

	const deleted: string[] = [];
	const now = Date.now();
	for (const shapeDir of shapeDirs) {
		const dir = path.join(CROPPED_ROOT, shapeDir);
		const files = await readdir(dir).catch(() => []);
		for (const file of files) {
			const filePath = path.join(dir, file);
			const info = await stat(filePath);
			if (now - info.mtimeMs > MAX_AGE_MS) {
				await rm(filePath, { force: true });
				deleted.push(`${shapeDir}/${file}`);
			}
		}
	}

	console.log(`Removed ${deleted.length} stale cropped file(s).`);
	for (const file of deleted) console.log(`  ${file}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
