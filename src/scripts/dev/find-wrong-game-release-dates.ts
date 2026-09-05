// Read-only diagnostic: cross-checks every stored GAME releaseDate against IGDB's release_dates
// array, flagging rows where the stored date is later than the true earliest release (the
// first_release_date-freezing bug fixed in src/server/igdb/ingest/game.ts). Run with:
//   npx tsx src/scripts/dev/find-wrong-game-release-dates.ts
import { db } from "@/server/db/client";
import { fetchIgdbGameById } from "@/server/igdb/client";
import { MediaType } from "@prisma/client";

// Flag only meaningful drift, not IGDB's usual day-level rounding differences.
const DRIFT_THRESHOLD_DAYS = 14;

async function main() {
	const games = await db.media.findMany({
		where: { type: MediaType.GAME, externalId: { not: null } },
		select: { id: true, title: true, externalId: true, releaseDate: true },
	});

	console.log(`Checking ${games.length} games against IGDB...`);
	const flagged: {
		id: number;
		title: string;
		stored: Date | null;
		earliest: Date | null;
	}[] = [];

	for (const game of games) {
		try {
			const igdbGame = await fetchIgdbGameById(game.externalId!);
			const dates = (igdbGame.release_dates ?? [])
				.map((rd) => rd.date)
				.filter((d): d is number => d != null);
			const earliestMs = dates.length > 0 ? Math.min(...dates) * 1000 : null;
			const earliest = earliestMs != null ? new Date(earliestMs) : null;

			if (!earliest || !game.releaseDate) continue;

			const driftDays =
				(game.releaseDate.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24);
			if (driftDays > DRIFT_THRESHOLD_DAYS) {
				flagged.push({
					id: game.id,
					title: game.title,
					stored: game.releaseDate,
					earliest,
				});
			}
		} catch (err) {
			console.warn(`Skipping "${game.title}" (id ${game.id}): ${err}`);
		}
	}

	console.log(`\nFlagged ${flagged.length} games with a later-than-earliest stored releaseDate:\n`);
	for (const f of flagged) {
		console.log(
			`#${f.id} ${f.title}: stored ${f.stored?.toISOString().slice(0, 10)} vs earliest ${f.earliest?.toISOString().slice(0, 10)}`,
		);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
