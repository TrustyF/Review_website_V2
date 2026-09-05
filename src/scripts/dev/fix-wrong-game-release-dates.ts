// Corrects GAME rows whose releaseDate got frozen to a later release (e.g. a full 1.0 launch)
// instead of the earliest one (e.g. an early access launch) — see
// src/server/igdb/ingest/game.ts and find-wrong-game-release-dates.ts. Run with:
//   CACHE_RESPONSES=0 npx tsx src/scripts/dev/fix-wrong-game-release-dates.ts
import { db } from "@/server/db/client";
import { fetchIgdbGameById } from "@/server/igdb/client";
import { MediaType } from "@prisma/client";

const DRIFT_THRESHOLD_DAYS = 14;

async function main() {
	const games = await db.media.findMany({
		where: { type: MediaType.GAME, externalId: { not: null } },
		select: { id: true, title: true, externalId: true, releaseDate: true },
	});

	console.log(`Checking ${games.length} games against IGDB...`);
	let fixed = 0;

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
				await db.media.update({
					where: { id: game.id },
					data: { releaseDate: earliest },
				});
				console.log(
					`Fixed #${game.id} ${game.title}: ${game.releaseDate.toISOString().slice(0, 10)} -> ${earliest.toISOString().slice(0, 10)}`,
				);
				fixed++;
			}
		} catch (err) {
			console.warn(`Skipping "${game.title}" (id ${game.id}): ${err}`);
		}
	}

	console.log(`\nFixed ${fixed} games.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
