"use server";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { isTipId } from "@/components/tips/tip-ids";

// Null when signed out, which TipsProvider treats as "show no tips".
export async function getMySeenTips(): Promise<string[] | null> {
	const session = await auth();
	if (!session?.user?.id) return null;

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { seenTips: true },
	});
	return user?.seenTips ?? null;
}

export async function markTipSeen(id: string): Promise<void> {
	if (!isTipId(id)) return;
	const session = await auth();
	if (!session?.user?.id) return;

	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { seenTips: true },
	});
	if (!user || user.seenTips.includes(id)) return;
	await db.user.update({
		where: { id: session.user.id },
		data: { seenTips: { push: id } },
	});
}
