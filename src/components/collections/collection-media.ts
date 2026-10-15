import { cache } from "react";
import { MediaStatus } from "@prisma/client";
import { db, dbPublic } from "@/server/db/client";
import {
	MediaCardRecord,
	toMediaCardRecord,
	toMediaRecord,
} from "@/components/media/types";

export type MediaCollection = {
	id: number;
	name: string;
	nameFr: string | null;
	// Release order, oldest first — the watch order.
	items: MediaCardRecord[];
};

export function collectionHref(id: number) {
	return `/collection/${id}`;
}

export function localizedCollectionName(
	collection: Pick<MediaCollection, "name" | "nameFr">,
	locale: string,
) {
	return locale === "fr"
		? (collection.nameFr ?? collection.name)
		: collection.name;
}

// Every catalog entry in a TMDB collection, in watch order; null when the collection doesn't exist.
export const getCollection = cache(
	async (collectionId: number): Promise<MediaCollection | null> => {
		const [collection, members] = await Promise.all([
			db.collection.findUnique({ where: { id: collectionId } }),
			dbPublic.media.findMany({
				where: {
					movie: { collectionId },
					// Upcoming entries belong in a franchise's watch order too.
					status: { in: Object.values(MediaStatus) },
				},
				include: { movie: true, review: true },
				orderBy: [
					{ releaseDate: { sort: "asc", nulls: "last" } },
					{ id: "asc" },
				],
			}),
		]);
		if (!collection) return null;
		return {
			id: collection.id,
			name: collection.name,
			nameFr: collection.nameFr,
			items: members.map((m) => toMediaCardRecord(toMediaRecord(m))),
		};
	},
);

// This movie's collection, or null unless it has at least one other entry.
// Reads collectionId itself rather than from getMediaCore, whose hour-long cache misses ingest-side changes.
export const getMediaCollection = cache(
	async (mediaId: number): Promise<MediaCollection | null> => {
		const movie = await db.movie.findUnique({
			where: { mediaID: mediaId },
			select: { collectionId: true },
		});
		if (movie?.collectionId == null) return null;
		const collection = await getCollection(movie.collectionId);
		return collection && collection.items.length >= 2 ? collection : null;
	},
);
