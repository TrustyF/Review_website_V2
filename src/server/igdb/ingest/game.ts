import { EnrichmentStatus, MediaStatus, MediaType } from "@prisma/client";
import { IgdbGame } from "@/server/igdb/schema";
import { db } from "@/server/db/client";
import { syncGameCreditsAndGenres } from "@/server/igdb/ingest/game-credits";

// IGDB's GameStatus enum — only the values we're confident about; anything
// else (including missing) is treated as RELEASED rather than guessed at.
const STATUS_MAP: Record<number, MediaStatus> = {
	0: MediaStatus.RELEASED, // Released
	2: MediaStatus.ONGOING, // Alpha
	3: MediaStatus.ONGOING, // Beta
	4: MediaStatus.ONGOING, // Early Access
	5: MediaStatus.RELEASED, // Offline
	6: MediaStatus.COMPLETED, // Cancelled
};

function buildMediaFields(game: IgdbGame) {
	return {
		title: game.name,
		overview: game.summary ?? null,
		releaseDate: game.first_release_date
			? new Date(game.first_release_date * 1000)
			: null,
		status:
			game.status != null
				? (STATUS_MAP[game.status] ?? MediaStatus.RELEASED)
				: MediaStatus.RELEASED,
		publicRating: game.total_rating != null ? game.total_rating / 10 : null,
		posterPath: game.cover?.image_id ?? null,
		// First artwork stands in for a banner — IGDB doesn't rank them, so
		// this is just whichever one the API lists first.
		bannerPath: game.artworks?.[0]?.image_id ?? null,
		sourceUrl: game.url,
	};
}

function buildPlatform(game: IgdbGame): string | null {
	const names = game.platforms?.map((p) => p.name) ?? [];
	return names.length ? names.join(", ") : null;
}

export async function addGameFromIgdb(game: IgdbGame) {
	const externalId = String(game.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.GAME },
		});
		if (existing) return existing;

		const media = await tx.media.create({
			data: {
				...buildMediaFields(game),
				type: MediaType.GAME,
				externalId,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				game: {
					create: {
						platform: buildPlatform(game),
					},
				},
			},
		});

		await syncGameCreditsAndGenres(tx, media.id, game);

		return media;
	});
}

export async function updateGameFromIgdb(game: IgdbGame) {
	const externalId = String(game.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.GAME },
		});
		if (!existing)
			throw new Error(
				`updateGameFromIgdb: no game found for externalId ${externalId}`,
			);

		await tx.media.update({
			where: { id: existing.id },
			data: {
				...buildMediaFields(game),
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				game: {
					update: {
						platform: buildPlatform(game),
					},
				},
			},
		});

		await syncGameCreditsAndGenres(tx, existing.id, game);

		return existing;
	});
}
