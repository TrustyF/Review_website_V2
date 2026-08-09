"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/poster-resolver";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { saveListThumbnail } from "@/server/resolvers/list-thumbnail-resolver";
import { readCroppedFile } from "@/server/resolvers/image-crop-resolver";

type ListInput = {
	title: string;
	description: string | null;
	thumbnailUrl: string | null;
};

// The Thumbnail URL field accepts a path copied out of /dev/image-crop
// (public/cropped/... — see that tool's own note on why it's temporary) as
// well as a real external URL. A /cropped/ path gets promoted here: its
// bytes get copied into public/list-thumbnails via saveListThumbnail (the
// same place a direct file upload already lands), and the permanent URL is
// what actually gets persisted — otherwise the list's thumbnail would stop
// resolving the moment cleanup-cropped-images.ts's maintenance sweep
// removes the temp file it still pointed at. Anything else (an external
// URL, or an already-/list-thumbnails/... value on an untouched edit)
// passes through unchanged, since readCroppedFile only returns bytes for a
// real /cropped/ file.
async function resolveThumbnailUrl(raw: string | null | undefined): Promise<string | null> {
	const trimmed = raw?.trim();
	if (!trimmed) return null;

	const cropped = await readCroppedFile(trimmed);
	return cropped ? saveListThumbnail(cropped) : trimmed;
}

export async function createList(input: ListInput): Promise<number> {
	if (!input.title.trim()) throw new Error("Title is required");

	const list = await db.list.create({
		data: {
			title: input.title.trim(),
			description: input.description?.trim() || null,
			thumbnail: await resolveThumbnailUrl(input.thumbnailUrl),
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
			thumbnail: await resolveThumbnailUrl(input.thumbnailUrl),
		},
	});

	revalidatePath("/lists");
	revalidatePath(`/lists/${id}`);
}

// Alternative to pasting a URL (see ListForm) — a locally-picked file,
// resized/re-encoded and written under public/list-thumbnails via
// saveListThumbnail, returning a URL that slots into the same thumbnailUrl
// field a pasted URL would.
export async function uploadListThumbnail(formData: FormData): Promise<string> {
	const file = formData.get("file");
	if (!(file instanceof File)) throw new Error("No file provided");

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveListThumbnail(bytes);
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

// Same typo tolerance as search-actions.ts's FUSE_OPTIONS — see that file's
// comment on what threshold/ignoreLocation are doing.
const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Fuzzy title match, scoped away from whatever's already in the list — the
// add-search on a list's own page is meant to find something new, not
// re-surface a member it already has. Unlike a Prisma `contains` filter,
// fuzzy ranking can't happen in the query itself, so this pulls every
// eligible candidate's title and ranks them in memory — fine at this app's
// scale (a personal collection, not a public catalog), but it's the one
// place this trades a bit of DB efficiency for typo tolerance.
export async function searchMediaForList(
	listId: number,
	query: string,
): Promise<ListMediaSearchResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			listItems: { none: { listId } },
		},
		select: { id: true, title: true, type: true, posterPath: true },
		orderBy: { id: "asc" },
	});

	return fuzzySearch(candidates, FUSE_OPTIONS, trimmed, SEARCH_LIMIT).map(
		(m) => ({
			id: m.id,
			title: m.title,
			type: m.type,
			posterSrc: toPosterSrc(m.id, m.posterPath),
		}),
	);
}
