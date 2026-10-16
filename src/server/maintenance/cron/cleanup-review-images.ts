import { db } from "@/server/db/client";
import { REVIEW_IMAGE_DIR } from "@/server/resolvers/asset-paths";
import { getImageStorage } from "@/server/storage/image-storage";
import { appendJobSummary, formatSummaryList } from "./job-summary";

// Grace period for an image inserted into a review that hasn't been saved as a draft or published yet.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Captures "<mediaId>/<file>", the same shape storage.list(REVIEW_IMAGE_DIR) returns.
const REFERENCE_REGEX = new RegExp(
	`${REVIEW_IMAGE_DIR}/(\\d+/[a-f0-9]+\\.\\w+)`,
	"g",
);

// Deletes review images no published body or draft references anymore. Safe to re-run any time / on a schedule.
async function main() {
	// Drafts are globally omitted in db/client.ts; an explicit select still returns them.
	const reviews = await db.review.findMany({
		select: { body: true, bodyFr: true, bodyDraft: true, bodyFrDraft: true },
	});

	const referenced = new Set<string>();
	for (const review of reviews) {
		for (const text of Object.values(review)) {
			if (!text) continue;
			for (const match of text.matchAll(REFERENCE_REGEX)) {
				referenced.add(match[1]!);
			}
		}
	}

	const storage = getImageStorage();
	const deleted: string[] = [];
	const now = Date.now();
	for (const file of await storage.list(REVIEW_IMAGE_DIR)) {
		if (referenced.has(file)) continue;
		const mtimeMs = await storage.statMtimeMs(REVIEW_IMAGE_DIR, file);
		if (mtimeMs === null || now - mtimeMs <= MAX_AGE_MS) continue;
		await storage.remove(REVIEW_IMAGE_DIR, file);
		deleted.push(file);
	}

	console.log(`Removed ${deleted.length} orphaned review image(s).`);
	for (const file of deleted) console.log(`  ${file}`);

	await appendJobSummary([
		"## Cleanup Review Images",
		"",
		`Removed ${deleted.length} orphaned review image(s).`,
		...(deleted.length > 0 ? ["", ...formatSummaryList(deleted)] : []),
	]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
