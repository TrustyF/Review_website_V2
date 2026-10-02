"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";

async function requireUserId(): Promise<string> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	return session.user.id;
}

// Signed-out reads get an empty set rather than throwing, since this is
// called unconditionally (see WatchedProvider), not from a gated path.
export async function getMyWatchedMediaIds(): Promise<number[]> {
	const session = await auth();
	if (!session?.user?.id) return [];

	const items = await db.watchedItem.findMany({
		where: { userId: session.user.id },
		select: { mediaId: true },
	});
	return items.map((item) => item.mediaId);
}

export async function markAsWatched(mediaId: number): Promise<void> {
	const userId = await requireUserId();

	// Watching something takes it off the watchlist.
	await db.$transaction([
		db.watchedItem.createMany({
			data: [{ userId, mediaId }],
			skipDuplicates: true,
		}),
		db.watchlistItem.deleteMany({ where: { userId, mediaId } }),
	]);

	revalidatePath("/account");
	revalidatePath("/watchlist");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
}

// Bulk version for the grid's multi-select; already-watched ids are skipped. Also drops them from the watchlist.
export async function markManyAsWatched(mediaIds: number[]): Promise<void> {
	const userId = await requireUserId();
	if (!mediaIds.length) return;

	await db.$transaction([
		db.watchedItem.createMany({
			data: mediaIds.map((mediaId) => ({ userId, mediaId })),
			skipDuplicates: true,
		}),
		db.watchlistItem.deleteMany({
			where: { userId, mediaId: { in: mediaIds } },
		}),
	]);

	revalidatePath("/account");
	revalidatePath("/watchlist");
	revalidatePath("/activity");
	for (const mediaId of mediaIds) revalidatePath(`/media/${mediaId}`);
}

export async function unmarkAsWatched(mediaId: number): Promise<void> {
	const userId = await requireUserId();

	await db.watchedItem.delete({
		where: { userId_mediaId: { userId, mediaId } },
	});

	revalidatePath("/account");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
}

// Bulk version for the grid's multi-select. Doesn't put anything back on the watchlist.
export async function unmarkManyAsWatched(mediaIds: number[]): Promise<void> {
	const userId = await requireUserId();
	if (!mediaIds.length) return;

	await db.watchedItem.deleteMany({
		where: { userId, mediaId: { in: mediaIds } },
	});

	revalidatePath("/account");
	revalidatePath("/activity");
	for (const mediaId of mediaIds) revalidatePath(`/media/${mediaId}`);
}
