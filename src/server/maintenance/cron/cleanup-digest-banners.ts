import { DIGEST_BANNER_COMPOSITE_DIR } from "@/server/resolvers/asset-paths";
import { getImageStorage } from "@/server/storage/image-storage";
import { appendJobSummary, formatSummaryList } from "./job-summary";

// Sent digests link straight to these banners, so deleting one breaks it in old emails.
// 90 days covers most re-opens; the newest few per language are kept regardless of age.
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const KEEP_NEWEST_PER_LOCALE = 3;

// Safe to re-run any time / on a schedule.
async function main() {
	const storage = getImageStorage();
	const now = Date.now();

	// Filenames are `${locale}-${hash}.jpeg` (resolveDigestBannerImage).
	const byLocale = new Map<string, { file: string; mtimeMs: number }[]>();
	for (const file of await storage.list(DIGEST_BANNER_COMPOSITE_DIR)) {
		const mtimeMs = await storage.statMtimeMs(
			DIGEST_BANNER_COMPOSITE_DIR,
			file,
		);
		if (mtimeMs === null) continue;
		const locale = file.split("-")[0] ?? "";
		const group = byLocale.get(locale) ?? [];
		group.push({ file, mtimeMs });
		byLocale.set(locale, group);
	}

	const deleted: string[] = [];
	for (const group of byLocale.values()) {
		group.sort((a, b) => b.mtimeMs - a.mtimeMs);
		for (const { file, mtimeMs } of group.slice(KEEP_NEWEST_PER_LOCALE)) {
			if (now - mtimeMs > MAX_AGE_MS) {
				await storage.remove(DIGEST_BANNER_COMPOSITE_DIR, file);
				deleted.push(file);
			}
		}
	}

	console.log(`Removed ${deleted.length} old digest banner(s).`);
	for (const file of deleted) console.log(`  ${file}`);

	await appendJobSummary([
		"## Cleanup Digest Banners",
		"",
		`Removed ${deleted.length} old digest banner(s).`,
		...(deleted.length > 0 ? ["", ...formatSummaryList(deleted)] : []),
	]);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
