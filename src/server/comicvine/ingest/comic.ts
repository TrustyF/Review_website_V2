import { EnrichmentStatus, MediaStatus, MediaType } from "@prisma/client";
import { ComicVineVolume } from "@/server/comicvine/schema";
import { db } from "@/server/db/client";
import { syncComicCreditsAndGenres } from "@/server/comicvine/ingest/comic-credits";

// ComicVine's "description" is a snippet of HTML (usually just <p> tags and
// links), unlike TMDB/MangaDex/IGDB which all hand back plain text.
function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function buildOverview(volume: ComicVineVolume): string | null {
	if (volume.deck) return volume.deck;
	if (volume.description) return stripHtml(volume.description) || null;
	return null;
}

// existing is only passed by updateComicFromComicVine (undefined on create) —
// every field below except status/publicRating only fills in if existing
// doesn't already have a value, whether that's a prior ingest or a hand edit
// in the media editor.
function buildMediaFields(
	volume: ComicVineVolume,
	existing?: {
		title: string;
		overview: string | null;
		releaseDate: Date | null;
		posterPath: string | null;
	} | null,
) {
	return {
		title: existing?.title ?? volume.name,
		overview: existing?.overview ?? buildOverview(volume),
		releaseDate:
			existing?.releaseDate ??
			(volume.start_year ? new Date(Number(volume.start_year), 0, 1) : null),
		// ComicVine's volume endpoint has no ongoing/completed/cancelled signal
		// to key off of — every tracked volume is treated as a released run.
		status: MediaStatus.RELEASED,
		publicRating: null,
		posterPath: existing?.posterPath ?? (volume.image?.medium_url ?? null),
		sourceUrl:
			volume.site_detail_url ??
			`https://comicvine.gamespot.com/volume/4050-${volume.id}/`,
	};
}

export async function addComicFromComicVine(volume: ComicVineVolume) {
	const externalId = String(volume.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.COMIC },
		});
		if (existing) return existing;

		const media = await tx.media.create({
			data: {
				...buildMediaFields(volume),
				type: MediaType.COMIC,
				externalId,
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				comic: {
					create: {
						chapterCount: volume.count_of_issues ?? null,
						volumeCount: null,
					},
				},
			},
		});

		await syncComicCreditsAndGenres(tx, media.id, volume);

		return media;
	});
}

export async function updateComicFromComicVine(volume: ComicVineVolume) {
	const externalId = String(volume.id);

	return db.$transaction(async (tx) => {
		const existing = await tx.media.findFirst({
			where: { externalId, type: MediaType.COMIC },
			include: { comic: true },
		});
		if (!existing)
			throw new Error(
				`updateComicFromComicVine: no comic found for externalId ${externalId}`,
			);

		await tx.media.update({
			where: { id: existing.id },
			data: {
				...buildMediaFields(volume, existing),
				lastEnrichedAt: new Date(),
				enrichmentStatus: EnrichmentStatus.DONE,
				comic: {
					update: {
						chapterCount:
							existing.comic?.chapterCount ?? (volume.count_of_issues ?? null),
					},
				},
			},
		});

		await syncComicCreditsAndGenres(tx, existing.id, volume);

		return existing;
	});
}
