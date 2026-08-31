"use server";
import { db } from "@/server/db/client";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { invalidateSearchIndex } from "@/components/search/search-actions";
import { revalidateMediaPaths } from "@/server/cache/revalidate-media";

type SubTableFields = Pick<
	Prisma.MediaCreateInput,
	"movie" | "tvShow" | "manga" | "comic" | "game" | "book"
>;

// Unlike ADDABLE_TYPES, this covers SHORT too, since a manual entry has no provider to search.
function subTableFor(type: MediaType): SubTableFields {
	switch (type) {
		case MediaType.MOVIE:
		case MediaType.SHORT:
			return { movie: { create: {} } };
		case MediaType.TVSHOW:
			return { tvShow: { create: {} } };
		case MediaType.MANGA:
			return { manga: { create: {} } };
		case MediaType.COMIC:
			return { comic: { create: {} } };
		case MediaType.GAME:
			return { game: { create: {} } };
		case MediaType.BOOK:
			return { book: { create: {} } };
	}
}

export async function createManualMedia(input: {
	type: MediaType;
	title: string;
	overview: string | null;
	releaseDate: string | null;
	posterUrl: string | null;
}): Promise<number> {
	await requireAdmin();
	if (!input.title.trim()) throw new Error("Title is required");

	const media = await db.media.create({
		data: {
			title: input.title.trim(),
			type: input.type,
			overview: input.overview?.trim() || null,
			releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
			posterPath: input.posterUrl?.trim() || null,
			// No provider backs a manual entry, so externalId stays null; null is exempt from the
			// @@unique([externalId, type]) constraint, so multiple manual entries per type coexist.
			externalId: null,
			enrichmentStatus: EnrichmentStatus.DONE,
			lastEnrichedAt: new Date(),
			...subTableFor(input.type),
		},
	});

	await invalidateSearchIndex();
	revalidateMediaPaths(media.id, input.type);
	return media.id;
}
