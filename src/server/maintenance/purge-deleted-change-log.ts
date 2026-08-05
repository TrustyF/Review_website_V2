import { access, unlink } from "fs/promises";
import path from "path";
import { db } from "@/server/db/client";
import { CHANGELOG_THUMB_DIR, posterFilename } from "@/server/resolvers/poster-resolver";

// How long a soft-deleted entry stays visible (greyed out) before this
// script permanently removes it — see change-log-actions.ts.
const RETENTION_DAYS = 5;

// Permanently removes change log entries that were soft-deleted more than
// RETENTION_DAYS ago, plus any cached poster thumbnail (see
// resolveChangelogPosterThumb) nothing else still references. Safe to
// re-run any time / on a schedule.
async function main() {
	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

	const toPurge = await db.mediaChangeLog.findMany({
		where: { deletedAt: { lt: cutoff } },
		select: { id: true, mediaId: true, field: true, oldValue: true, newValue: true },
	});

	if (toPurge.length === 0) {
		console.log(`Purged 0 change log entries deleted more than ${RETENTION_DAYS} days ago.`);
		return;
	}

	// Every {mediaId, posterPath} this batch could have a cached thumbnail
	// for — collected before deleting, since oldValue/newValue only exist on
	// the rows about to go away.
	const candidates = new Map<string, { mediaId: number; posterPath: string }>();
	for (const entry of toPurge) {
		if (entry.field !== "posterPath") continue;
		for (const value of [entry.oldValue, entry.newValue]) {
			if (!value) continue;
			candidates.set(`${entry.mediaId}:${value}`, { mediaId: entry.mediaId, posterPath: value });
		}
	}

	await db.mediaChangeLog.deleteMany({
		where: { id: { in: toPurge.map((entry) => entry.id) } },
	});

	// A {mediaId, posterPath} pair can appear in more than one row (e.g. one
	// edit's newValue is the next edit's oldValue) — only remove the cached
	// file once nothing still references it.
	let filesRemoved = 0;
	for (const { mediaId, posterPath } of candidates.values()) {
		const stillReferenced = await db.mediaChangeLog.findFirst({
			where: {
				mediaId,
				field: "posterPath",
				OR: [{ oldValue: posterPath }, { newValue: posterPath }],
			},
			select: { id: true },
		});
		if (stillReferenced) continue;

		const filePath = path.join(CHANGELOG_THUMB_DIR, posterFilename(mediaId, posterPath));
		try {
			await access(filePath);
			await unlink(filePath);
			filesRemoved++;
		} catch {
			// Already gone, or never got cached in the first place — nothing to do.
		}
	}

	console.log(
		`Purged ${toPurge.length} change log entr${toPurge.length === 1 ? "y" : "ies"} deleted more than ${RETENTION_DAYS} days ago (removed ${filesRemoved} cached thumbnail file${filesRemoved === 1 ? "" : "s"}).`,
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
