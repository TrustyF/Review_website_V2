"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
import { mediaAssetFilename } from "@/server/resolvers/poster-resolver";

type ListInput = {
	title: string;
	description: string | null;
	thumbnailUrl: string | null;
};

export async function createList(input: ListInput): Promise<number> {
	if (!input.title.trim()) throw new Error("Title is required");

	const list = await db.list.create({
		data: {
			title: input.title.trim(),
			description: input.description?.trim() || null,
			thumbnail: input.thumbnailUrl?.trim() || null,
		},
	});

	revalidatePath("/lists");
	return list.id;
}

export async function updateList(id: number, input: ListInput): Promise<void> {
	if (!input.title.trim()) throw new Error("Title is required");

	await db.list.update({
		where: { id },
		data: {
			title: input.title.trim(),
			description: input.description?.trim() || null,
			thumbnail: input.thumbnailUrl?.trim() || null,
		},
	});

	revalidatePath("/lists");
	revalidatePath(`/lists/${id}`);
}

export async function deleteList(id: number): Promise<void> {
	await db.list.delete({ where: { id } });
	revalidatePath("/lists");
}

export async function addMediaToList(
	listId: number,
	mediaId: number,
): Promise<void> {
	await db.listItem.createMany({
		data: [{ listId, mediaId }],
		skipDuplicates: true,
	});

	revalidatePath(`/lists/${listId}`);
	revalidatePath("/lists");
	revalidatePath(`/media/${mediaId}`);
}

export async function removeMediaFromList(
	listId: number,
	mediaId: number,
): Promise<void> {
	await db.listItem.delete({
		where: { listId_mediaId: { listId, mediaId } },
	});

	revalidatePath(`/lists/${listId}`);
	revalidatePath("/lists");
	revalidatePath(`/media/${mediaId}`);
}

export type ListMediaSearchResult = {
	id: number;
	title: string;
	type: string;
	posterSrc: string;
};

const SEARCH_LIMIT = 20;

// Title-only match, scoped away from whatever's already in the list — the
// add-search on a list's own page is meant to find something new, not
// re-surface a member it already has.
export async function searchMediaForList(
	listId: number,
	query: string,
): Promise<ListMediaSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const rows = await dbPublic.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			title: { contains: trimmed, mode: "insensitive" },
			listItems: { none: { listId } },
		},
		orderBy: { id: "asc" },
		take: SEARCH_LIMIT,
	});

	return rows.map((m) => ({
		id: m.id,
		title: m.title,
		type: m.type,
		posterSrc: m.posterPath
			? `/api/poster/${m.id}/${mediaAssetFilename(m.id, m.posterPath)}`
			: "/posters/placeholder.jpg",
	}));
}
