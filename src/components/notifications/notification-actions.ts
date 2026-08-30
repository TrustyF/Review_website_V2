"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import type { NotificationType } from "@prisma/client";

export type NotificationEntry = {
	id: number;
	type: NotificationType;
	createdAt: Date;
	readAt: Date | null;
	list: { id: number; title: string } | null;
	media: { id: number; title: string } | null;
	message: string | null;
};

const NOTIFICATION_SELECT = {
	id: true,
	type: true,
	createdAt: true,
	readAt: true,
	list: { select: { id: true, title: true } },
	media: { select: { id: true, title: true } },
	message: true,
} as const;

async function requireUserId(): Promise<string> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	return session.user.id;
}

// Called from the two admin write sites that currently produce a
// notification (createList, addMediaToList in list-actions.ts) — kept here
// rather than inlined at each call site so a 3rd write site later is a
// one-line call, not a duplicated db.notification.create.
//
// markAsRead is for CRON_JOB_SUCCEEDED (see notify-admin-success.ts) — a
// routine success shouldn't bump getUnreadNotificationCount's badge the way
// an actual failure should, but should still show up for anyone who opens
// the notification list looking for a paper trail of what ran.
export async function createNotification(input: {
	type: NotificationType;
	userId: string;
	listId?: number;
	mediaId?: number;
	message?: string;
	markAsRead?: boolean;
}): Promise<void> {
	const { markAsRead, ...data } = input;
	await db.notification.create({
		data: { ...data, readAt: markAsRead ? new Date() : null },
	});
}

const PAGE_SIZE = 50;

// Most-recent-first, capped rather than paginated — same small-scale
// tradeoff as list-actions.ts's searchMediaForList and activity-actions.ts's
// getActivityFeed; a personal site's per-user notification volume never gets
// deep enough to need real pagination.
export async function getNotifications(): Promise<NotificationEntry[]> {
	const userId = await requireUserId();
	return db.notification.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		take: PAGE_SIZE,
		select: NOTIFICATION_SELECT,
	});
}

export async function getUnreadNotificationCount(): Promise<number> {
	const userId = await requireUserId();
	return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(id: number): Promise<void> {
	const userId = await requireUserId();
	// where: { id, userId } rather than a plain { id } — a user can only ever
	// mark their own notifications read, same scoping requireAdmin's
	// server-action callers rely on elsewhere for their own row.
	await db.notification.updateMany({
		where: { id, userId, readAt: null },
		data: { readAt: new Date() },
	});
	revalidatePath("/account/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
	const userId = await requireUserId();
	await db.notification.updateMany({
		where: { userId, readAt: null },
		data: { readAt: new Date() },
	});
	revalidatePath("/account/notifications");
}
