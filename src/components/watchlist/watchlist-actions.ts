"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { auth } from "@/auth";

async function requireUserId(): Promise<string> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	return session.user.id;
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
