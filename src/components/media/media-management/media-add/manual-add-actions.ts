"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";

type SubTableFields = Pick<
	Prisma.MediaCreateInput,
	"movie" | "tvShow" | "manga" | "comic" | "game"
>;

// Every real MediaType is manually creatable — unlike ADDABLE_TYPES (which
// only lists types with a working provider search), this covers SHORT too,
// since a manual entry has no provider it could have failed to find in the
// first place.
function subTableFor(type: MediaType): SubTableFields {
	switch (type) {
		case MediaType.MOVIE:
		case MediaType.SHORT:
			return { movie: { create: { runtime: 0 } } };
		case MediaType.TVSHOW:
			return { tvShow: { create: {} } };
		case MediaType.MANGA:
			return { manga: { create: {} } };
		case MediaType.COMIC:
			return { comic: { create: {} } };
		case MediaType.GAME:
			return { game: { create: {} } };
	}
}

export async function createManualMedia(input: {
	type: MediaType;
	title: string;
	overview: string | null;
	releaseDate: string | null;
	posterUrl: string | null;
}): Promise<number> {
	if (!input.title.trim()) throw new Error("Title is required");

	const media = await db.media.create({
		data: {
			title: input.title.trim(),
			type: input.type,
			overview: input.overview?.trim() || null,
			releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
			posterPath: input.posterUrl?.trim() || null,
			// No provider backs a manual entry — externalId is left null rather
			// than guessed at, same as sourceUrl. enrich-db.ts filters these out
			// (nothing to fetch), and null is exempt from the @@unique([externalId,
			// type]) constraint, so any number of manual entries per type coexist.
			externalId: null,
			enrichmentStatus: EnrichmentStatus.DONE,
			lastEnrichedAt: new Date(),
			...subTableFor(input.type),
		},
	});

	revalidatePath("/");
	return media.id;
}
