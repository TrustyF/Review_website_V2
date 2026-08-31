import { CROPPED_DIR } from "@/server/resolvers/image-crop-resolver";
import { getImageStorage } from "@/server/storage/image-storage";
import { appendJobSummary, formatSummaryList } from "./job-summary";

// Nothing in the DB ever references a /cropped/... path directly, so age is the only check needed (no orphan check). 24h gives a generous grace period to paste a crop in later.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Safe to re-run any time / on a schedule.
async function main() {
	const storage = getImageStorage();

	const deleted: string[] = [];
	const now = Date.now();
	const files = await storage.list(CROPPED_DIR);
	for (const file of files) {
		const mtimeMs = await storage.statMtimeMs(CROPPED_DIR, file);
		if (mtimeMs !== null && now - mtimeMs > MAX_AGE_MS) {
			await storage.remove(CROPPED_DIR, file);
			deleted.push(file);
		}
	}

	console.log(`Removed ${deleted.length} stale cropped file(s).`);
	for (const file of deleted) console.log(`  ${file}`);

	await appendJobSummary([
		"## Cleanup Cropped Images",
		"",
		`Removed ${deleted.length} stale cropped file(s).`,
		...(deleted.length > 0 ? ["", ...formatSummaryList(deleted)] : []),
	]);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
