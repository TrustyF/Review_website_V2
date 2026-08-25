"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, ListSortMode } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/poster-resolver";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { saveListThumbnail } from "@/server/resolvers/list-thumbnail-resolver";
import { readCroppedFile } from "@/server/resolvers/image-crop-resolver";
import { requireAdmin } from "@/lib/auth/require-admin";

type ListInput = {
	title: string;
	description: string | null;
	thumbnailUrl: string | null;
	sortMode: ListSortMode;
	// null = a normal, publicly-listed list. A user id makes this a
	// recommendation list deposited into that one account — see
	// List.targetUserId's own comment in list.prisma.
	targetUserId: string | null;
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
	await requireAdmin();
	if (!input.title.trim()) throw new Error("Title is required");

	const list = await db.list.create({
		data: {
			title: input.title.trim(),
			description: input.description?.trim() || null,
			thumbnail: await resolveThumbnailUrl(input.thumbnailUrl),
			sortMode: input.sortMode,
			targetUserId: input.targetUserId,
		},
	});

	revalidatePath("/lists");
	revalidatePath("/activity");
	// /account is already rendered dynamically (it reads the session via
	// auth()), so this is belt-and-suspenders rather than load-bearing, but
	// costs nothing to keep in step with every other list mutation here.
	revalidatePath("/account");
	return list.id;
}

export async function updateList(id: number, input: ListInput): Promise<void> {
	await requireAdmin();
	if (!input.title.trim()) throw new Error("Title is required");

	await db.list.update({
		where: { id },
		data: {
			title: input.title.trim(),
			description: input.description?.trim() || null,
			thumbnail: await resolveThumbnailUrl(input.thumbnailUrl),
			sortMode: input.sortMode,
			targetUserId: input.targetUserId,
		},
	});

	revalidatePath("/lists");
	revalidatePath(`/lists/${id}`);
	revalidatePath("/account");
}

export type RecommendationTargetOption = {
	id: string;
	username: string | null;
	name: string | null;
	email: string | null;
	// Whatever's currently saved on User.image — a preset avatar path (see
	// src/lib/avatars.ts) or an OAuth provider's picture URL. UserPicker
	// falls back to a placeholder icon when this is null (or fails to load).
	image: string | null;
};

// Populates ListForm's "recommend to" picker (see UserPicker) — every
// non-admin registered user, since this is a small trusted-circle site (see
// AGENTS.md) with no expectation of paging through a large user table.
// Admins excluded — a recommendation list is for a regular member's account,
// not a fellow curator's.
export async function listRecommendationTargets(): Promise<
	RecommendationTargetOption[]
> {
	await requireAdmin();

	return db.user.findMany({
		where: { role: { not: "ADMIN" } },
		orderBy: { createDate: "asc" },
		select: { id: true, username: true, name: true, email: true, image: true },
	});
}

// Alternative to pasting a URL (see ListForm) — a locally-picked file,
// resized/re-encoded and written under public/list-thumbnails via
// saveListThumbnail, returning a URL that slots into the same thumbnailUrl
// field a pasted URL would.
export async function uploadListThumbnail(formData: FormData): Promise<string> {
	await requireAdmin();
	const file = formData.get("file");
	if (!(file instanceof File)) throw new Error("No file provided");

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveListThumbnail(bytes);
}

export async function deleteList(id: number): Promise<void> {
	await requireAdmin();
	await db.list.delete({ where: { id } });
	revalidatePath("/lists");
}

export async function addMediaToList(
	listId: number,
	mediaId: number,
): Promise<void> {
	await requireAdmin();
	// New items always append to the bottom of the ranking, never jump ahead
	// of what's already there — same idea as appending to an array.
	const { _max } = await db.listItem.aggregate({
		where: { listId },
		_max: { rank: true },
	});

	await db.listItem.createMany({
		data: [{ listId, mediaId, rank: (_max.rank ?? -1) + 1 }],
		skipDuplicates: true,
	});

	revalidatePath(`/lists/${listId}`);
	revalidatePath("/lists");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
}

export async function removeMediaFromList(
	listId: number,
	mediaId: number,
): Promise<void> {
	await requireAdmin();
	await db.listItem.delete({
		where: { listId_mediaId: { listId, mediaId } },
	});

	revalidatePath(`/lists/${listId}`);
	revalidatePath("/lists");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
}

// Persists a drag-and-drop reorder (see ranked-list.tsx) — orderedMediaIds
// is the full new top-to-bottom order, rewriting every item's rank to match
// its index. Simple 0..n-1 renumbering rather than fractional/gap-based
// positions: always correct, and cheap at this app's scale (a personal
// collection's lists run to tens of items). Any ListItem row not present in
// orderedMediaIds (a filtered-out or deleted-media row — see ranked-list.tsx's
// own note on why reordering is disabled while filtered) simply keeps its
// prior rank untouched, which is harmless since a row that's never rendered
// can't have its position observed anyway.
export async function reorderListItems(
	listId: number,
	orderedMediaIds: number[],
): Promise<void> {
	await requireAdmin();
	await db.$transaction(
		orderedMediaIds.map((mediaId, index) =>
			db.listItem.update({
				where: { listId_mediaId: { listId, mediaId } },
				data: { rank: index },
			}),
		),
	);

	revalidatePath(`/lists/${listId}`);
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
	await requireAdmin();
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
