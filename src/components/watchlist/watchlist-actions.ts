"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";

async function requireUserId(): Promise<string> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	return session.user.id;
}

// Signed-out reads get an empty watchlist rather than throwing, since this is
// called unconditionally (see WatchlistProvider), not from a gated path.
export async function getMyWatchlistMediaIds(): Promise<number[]> {
	const session = await auth();
	if (!session?.user?.id) return [];

	const items = await db.watchlistItem.findMany({
		where: { userId: session.user.id },
		select: { mediaId: true },
	});
	return items.map((item) => item.mediaId);
}

export async function addToWatchlist(mediaId: number): Promise<void> {
	const userId = await requireUserId();

	await db.watchlistItem.createMany({
		data: [{ userId, mediaId }],
		skipDuplicates: true,
	});

	revalidatePath("/account");
	revalidatePath("/watchlist");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
}

// Bulk version for the grid's multi-select; already-watchlisted ids are skipped.
export async function addManyToWatchlist(mediaIds: number[]): Promise<void> {
	const userId = await requireUserId();
	if (!mediaIds.length) return;

	await db.watchlistItem.createMany({
		data: mediaIds.map((mediaId) => ({ userId, mediaId })),
		skipDuplicates: true,
	});

	revalidatePath("/account");
	revalidatePath("/watchlist");
	revalidatePath("/activity");
	for (const mediaId of mediaIds) revalidatePath(`/media/${mediaId}`);
}

export async function removeFromWatchlist(mediaId: number): Promise<void> {
	const userId = await requireUserId();

	await db.watchlistItem.delete({
		where: { userId_mediaId: { userId, mediaId } },
	});

	revalidatePath("/account");
	revalidatePath("/watchlist");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
}
