import { Prisma } from "@prisma/client";
import { TmdbMovieResponse } from "@/server/tmdb/schema";
import { fetchTmdbCollectionFrenchName } from "@/server/tmdb/client";

// Finds or creates the movie's TMDB collection; the French name is only fetched the first time it's seen.
export async function resolveMovieCollection(
	tx: Prisma.TransactionClient,
	data: TmdbMovieResponse,
): Promise<number | null> {
	const source = data.belongs_to_collection;
	if (!source) return null;
	const externalId = String(source.id);

	const existing = await tx.collection.findUnique({ where: { externalId } });
	if (existing) {
		if (existing.name !== source.name)
			await tx.collection.update({
				where: { id: existing.id },
				data: { name: source.name },
			});
		return existing.id;
	}

	// Some (newer) collections 404 on /translations; a missing French name shouldn't fail the movie.
	const nameFr = await fetchTmdbCollectionFrenchName(externalId).catch(
		() => null,
	);
	const created = await tx.collection.upsert({
		where: { externalId },
		update: {},
		create: { externalId, name: source.name, nameFr },
	});
	return created.id;
}
