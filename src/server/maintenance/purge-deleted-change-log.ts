import { access, unlink } from "fs/promises";
import path from "path";
import { db } from "@/server/db/client";
import {
	CHANGELOG_BANNER_THUMB_DIR,
	CHANGELOG_THUMB_DIR,
	mediaAssetFilename,
} from "@/server/resolvers/poster-resolver";

// How long a soft-deleted entry stays visible (greyed out) before this
// script permanently removes it — see change-log-actions.ts.
const RETENTION_DAYS = 1;

type Purgeable = {
	id: number;
	mediaId: number;
	field: string;
	oldValue: string | null;
	newValue: string | null;
};

// Removes dir's cached thumbnail for every {mediaId, value} this batch could
// have one for (posterPath -> CHANGELOG_THUMB_DIR, bannerPath ->
// CHANGELOG_BANNER_THUMB_DIR), skipping any pair a surviving (non-purged)
// row still references — the same pair can appear in more than one row,
// e.g. one edit's newValue is the next edit's oldValue.
async function purgeThumbnails(
	toPurge: Purgeable[],
	field: string,
	dir: string,
) {
	const candidates = new Map<string, { mediaId: number; value: string }>();
	for (const entry of toPurge) {
		if (entry.field !== field) continue;
		for (const value of [entry.oldValue, entry.newValue]) {
			if (!value) continue;
			candidates.set(`${entry.mediaId}:${value}`, {
				mediaId: entry.mediaId,
				value,
			});
		}
	}

	let filesRemoved = 0;
	for (const { mediaId, value } of candidates.values()) {
		const stillReferenced = await db.mediaChangeLog.findFirst({
			where: { mediaId, field, OR: [{ oldValue: value }, { newValue: value }] },
			select: { id: true },
		});
		if (stillReferenced) continue;

		const filePath = path.join(dir, mediaAssetFilename(mediaId, value));
		try {
			await access(filePath);
			await unlink(filePath);
			filesRemoved++;
		} catch {
			// Already gone, or never got cached in the first place — nothing to do.
		}
	}
	return filesRemoved;
}

// Permanently removes change log entries that were soft-deleted more than
// RETENTION_DAYS ago, plus any cached poster/banner thumbnail (see
// resolveChangelogPosterThumb / resolveChangelogBannerThumb) nothing else
// still references. Safe to re-run any time / on a schedule.
async function main() {
	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

	const toPurge = await db.mediaChangeLog.findMany({
		where: { deletedAt: { lt: cutoff } },
		select: {
			id: true,
			mediaId: true,
			field: true,
			oldValue: true,
			newValue: true,
		},
	});

	if (toPurge.length === 0) {
		console.log(
			`Purged 0 change log entries deleted more than ${RETENTION_DAYS} days ago.`,
		);
		return;
	}

	// oldValue/newValue only exist on these rows while they're still here —
	// purgeThumbnails' "is this still referenced" check needs them gone from
	// the table first to correctly see only survivors.
	await db.mediaChangeLog.deleteMany({
		where: { id: { in: toPurge.map((entry) => entry.id) } },
	});

	const posterFilesRemoved = await purgeThumbnails(
		toPurge,
		"posterPath",
		CHANGELOG_THUMB_DIR,
	);
	const bannerFilesRemoved = await purgeThumbnails(
		toPurge,
		"bannerPath",
		CHANGELOG_BANNER_THUMB_DIR,
	);

	console.log(
		`Purged ${toPurge.length} change log entr${toPurge.length === 1 ? "y" : "ies"} deleted more than ${RETENTION_DAYS} days ago ` +
			`(removed ${posterFilesRemoved} poster thumbnail file${posterFilesRemoved === 1 ? "" : "s"}, ` +
			`${bannerFilesRemoved} banner thumbnail file${bannerFilesRemoved === 1 ? "" : "s"}).`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
