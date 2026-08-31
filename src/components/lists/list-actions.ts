"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, ListSortMode } from "@prisma/client";
import { toPosterSrc } from "@/server/resolvers/poster-resolver";
import { fuzzySearch } from "@/lib/fuzzy-search";
import {
	isListThumbnailUrl,
	saveListThumbnail,
	saveListThumbnailFromUrl,
} from "@/server/resolvers/list-thumbnail-resolver";
import { readCroppedFile } from "@/server/resolvers/image-crop-resolver";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createNotification } from "@/components/notifications/notification-actions";

type ListInput = {
	title: string;
	description: string | null;
	thumbnailUrl: string | null;
	sortMode: ListSortMode;
	// null = normal public list; a user id makes this a recommendation list for that account.
	targetUserId: string | null;
};

// Normalizes any thumbnail input (existing URL, /cropped/ temp file, or external link) into a self-hosted list-thumbnails URL, so nothing hotlinks another host or breaks when temp files get cleaned up.
async function resolveThumbnailUrl(raw: string | null | undefined): Promise<string | null> {
	const trimmed = raw?.trim();
	if (!trimmed) return null;
	if (isListThumbnailUrl(trimmed)) return trimmed;

	const cropped = await readCroppedFile(trimmed);
	return cropped ? saveListThumbnail(cropped) : saveListThumbnailFromUrl(trimmed);
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

	if (input.targetUserId) {
		await createNotification({
			type: "LIST_CREATED",
			userId: input.targetUserId,
			listId: list.id,
		});
	}

	revalidatePath("/lists");
	revalidatePath("/activity");
	// Belt-and-suspenders; /account already renders dynamically.
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
	// Preset avatar path or OAuth picture URL; UserPicker falls back to a placeholder when null.
	image: string | null;
};

// Populates ListForm's "recommend to" picker: every non-admin user (small trusted-circle site, no pagination needed).
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

export type UserListSummary = {
	id: number;
	title: string;
	description: string | null;
	thumbnail: string | null;
	itemCount: number;
};

// Powers the admin "User lists" browser: same query as AccountPage's own recommendations, parametrized to an admin-selected user.
export async function getListsForUser(
	targetUserId: string,
): Promise<UserListSummary[]> {
	await requireAdmin();

	const lists = await db.list.findMany({
		where: { targetUserId },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});

	return lists.map((list) => ({
		id: list.id,
		title: list.title,
		description: list.description,
		thumbnail: list.thumbnail,
		itemCount: list._count.items,
	}));
}

// Alternative to pasting a URL: saves a locally-picked file and returns a URL for the same thumbnailUrl field.
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
	// New items always append to the bottom of the ranking.
	const { _max } = await db.listItem.aggregate({
		where: { listId },
		_max: { rank: true },
	});

	await db.listItem.createMany({
		data: [{ listId, mediaId, rank: (_max.rank ?? -1) + 1 }],
		skipDuplicates: true,
	});

	// Only a recommendation list has anyone to notify; a public list's items already show up in /activity.
	const list = await db.list.findUnique({
		where: { id: listId },
		select: { targetUserId: true },
	});
	if (list?.targetUserId) {
		await createNotification({
			type: "LIST_ITEM_ADDED",
			userId: list.targetUserId,
			listId,
			mediaId,
		});
	}

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

// Persists a drag-and-drop reorder: rewrites every item's rank to its index in the new order. Simple 0..n-1 renumbering rather than fractional positions — cheap at this app's scale. Rows missing from orderedMediaIds keep their prior rank untouched.
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

// Same typo tolerance as search-actions.ts's FUSE_OPTIONS.
const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Fuzzy title match scoped away from existing list items; ranks all eligible candidates in memory since Prisma can't do fuzzy matching in-query (fine at this app's scale).
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
