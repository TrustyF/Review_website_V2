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

	await db.watchedItem.createMany({
		data: [{ userId, mediaId }],
		skipDuplicates: true,
	});

	revalidatePath("/account");
	revalidatePath(`/media/${mediaId}`);
	revalidatePath("/activity");
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
