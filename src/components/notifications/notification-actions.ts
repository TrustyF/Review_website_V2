"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { resolveChangelogPosterThumb } from "@/server/resolvers/poster-resolver";
import type { MediaType, NotificationType } from "@prisma/client";

export type NotificationEntry = {
	id: number;
	type: NotificationType;
	createdAt: Date;
	readAt: Date | null;
	list: {
		id: number;
		title: string;
		titleFr: string | null;
		thumbnail: string | null;
	} | null;
	media: { id: number; title: string; titleFr: string | null; posterSrc: string } | null;
	// LIST_ITEM_ADDED row standing in for same-day notifications. id/media/list/createdAt are from most recent one.
	groupedIds?: number[];
	// Same list, items added same day (see groupSameDayListAdditions).
	groupedMedia?: NonNullable<NotificationEntry["media"]>[];
	// Same media added to multiple lists same day; only for rows unclaimed by list-grouping.
	groupedLists?: NonNullable<NotificationEntry["list"]>[];
	// True when this list's own LIST_CREATED row folded into the same-day group
	// (see groupSameDayListAdditions) — caption reads "Created and added" instead of "Added".
	listCreated?: boolean;
};

// Same fallback as asset-paths.ts's toPosterSrc for a posterPath-less media row.
const PLACEHOLDER_POSTER_SRC = "/posters/placeholder.jpg";

const NOTIFICATION_SELECT = {
	id: true,
	type: true,
	createdAt: true,
	readAt: true,
	list: {
		select: { id: true, title: true, titleFr: true, thumbnail: true },
	},
	media: {
		select: {
			id: true,
			title: true,
			titleFr: true,
			type: true,
			posterPath: true,
			externalId: true,
		},
	},
} as const;

// Small pre-cached thumbnail (like activity-actions); stays resolvable for deleted media
async function toMediaEntry(
	media: {
		id: number;
		title: string;
		titleFr: string | null;
		type: MediaType;
		posterPath: string | null;
		externalId: string | null;
	} | null,
): Promise<NotificationEntry["media"]> {
	if (!media) return null;
	const posterSrc = media.posterPath
		? await resolveChangelogPosterThumb(
				media.id,
				media.type,
				media.externalId,
				media.posterPath,
			)
		: PLACEHOLDER_POSTER_SRC;
	return { id: media.id, title: media.title, titleFr: media.titleFr, posterSrc };
}

type RawNotification = {
	id: number;
	type: NotificationType;
	createdAt: Date;
	readAt: Date | null;
	list: {
		id: number;
		title: string;
		titleFr: string | null;
		thumbnail: string | null;
	} | null;
	media: {
		id: number;
		title: string;
		titleFr: string | null;
		type: MediaType;
		posterPath: string | null;
		externalId: string | null;
	} | null;
};

// Same-day LIST_ITEM_ADDED rows sharing a list or media item, newest-first. members[0] is representative. axis unset if group never grew past single member.
type NotificationGroup = {
	members: RawNotification[];
	axis?: "list" | "media";
};

// Groups same-list additions by day; also folds in that list's own
// LIST_CREATED row when it lands the same day, so it reads as one moment.
function groupSameDayListAdditions(
	entries: RawNotification[],
): NotificationGroup[] {
	const grouped: NotificationGroup[] = [];
	const groupByKey = new Map<string, NotificationGroup>();

	for (const entry of entries) {
		const key =
			(entry.type === "LIST_ITEM_ADDED" || entry.type === "LIST_CREATED") &&
			entry.list
				? `${entry.list.id}-${entry.createdAt.toDateString()}`
				: null;
		const existing = key ? groupByKey.get(key) : undefined;

		if (existing) {
			existing.members.push(entry);
			existing.axis = "list";
			continue;
		}

		const group: NotificationGroup = { members: [entry] };
		grouped.push(group);
		if (key) groupByKey.set(key, group);
	}

	return grouped;
}

// Inverse of list-grouping: same media to multiple lists. Runs second over unclaimed groups.
function groupSameDayMediaAdditions(
	groups: NotificationGroup[],
): NotificationGroup[] {
	const result: NotificationGroup[] = [];
	const groupByKey = new Map<string, NotificationGroup>();

	for (const group of groups) {
		if (group.members.length > 1) {
			result.push(group);
			continue;
		}

		const entry = group.members[0]!;
		const key =
			entry.type === "LIST_ITEM_ADDED" && entry.media && entry.list
				? `${entry.media.id}-${entry.createdAt.toDateString()}`
				: null;
		const existing = key ? groupByKey.get(key) : undefined;

		if (existing) {
			existing.members.push(entry);
			existing.axis = "media";
			continue;
		}

		result.push(group);
		if (key) groupByKey.set(key, group);
	}

	return result;
}

async function requireUserId(): Promise<string> {
	const session = await auth();
	if (!session?.user?.id) throw new Error("Not signed in");
	return session.user.id;
}

// Centralized so future write sites need one-line call, not duplicated db.notification.create
export async function createNotification(input: {
	type: NotificationType;
	userId: string;
	listId?: number;
	mediaId?: number;
}): Promise<void> {
	await db.notification.create({ data: { ...input, readAt: null } });
}

const PAGE_SIZE = 50;

// Most-recent-first, capped not paginated (same tradeoff as searchMediaBrowser/getActivityFeed). Personal site's per-user volume never needs pagination.
export async function getNotifications(): Promise<NotificationEntry[]> {
	const userId = await requireUserId();
	const notifications = await db.notification.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		take: PAGE_SIZE,
		select: NOTIFICATION_SELECT,
	});
	const groups = groupSameDayMediaAdditions(
		groupSameDayListAdditions(notifications),
	);
	return Promise.all(
		groups.map(async ({ members, axis }): Promise<NotificationEntry> => {
			// members is always non-empty (grouping always starts a group with
			// the entry that created it).
			const [representative, ...rest] = members as [
				RawNotification,
				...RawNotification[],
			];
			const media = await toMediaEntry(representative.media);
			// An older member's unread state shouldn't hide behind the newest
			// member happening to already be read.
			const readAt = members.some((m) => m.readAt === null)
				? null
				: representative.readAt;

			if (rest.length === 0) {
				return { ...representative, media, readAt };
			}

			if (axis === "list") {
				const groupedMedia = (
					await Promise.all(members.map((m) => toMediaEntry(m.media)))
				).filter((m) => m !== null);
				const listCreated = members.some((m) => m.type === "LIST_CREATED");
				return {
					...representative,
					media,
					readAt,
					groupedIds: rest.map((m) => m.id),
					groupedMedia,
					...(listCreated ? { listCreated } : {}),
				};
			}

			const groupedLists = members
				.map((m) => m.list)
				.filter((l) => l !== null);
			return {
				...representative,
				media,
				readAt,
				groupedIds: rest.map((m) => m.id),
				groupedLists,
			};
		}),
	);
}

export async function getUnreadNotificationCount(): Promise<number> {
	const userId = await requireUserId();
	return db.notification.count({ where: { userId, readAt: null } });
}

// Takes batch (single id = length-1 call) for grouped rows.
export async function markNotificationsRead(ids: number[]): Promise<void> {
	const userId = await requireUserId();
	// Includes userId scope so users only mark their own notifications read.
	await db.notification.updateMany({
		where: { id: { in: ids }, userId, readAt: null },
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
