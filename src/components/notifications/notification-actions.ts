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
	list: { id: number; title: string; thumbnail: string | null } | null;
	media: { id: number; title: string; posterSrc: string } | null;
	message: string | null;
	// Present only for a LIST_ITEM_ADDED row standing in for several same-day
	// notifications (either axis below) — id/media/list/createdAt above are
	// the most recent one's.
	groupedIds?: number[];
	// Same list, several media added the same day (see groupSameDayListAdditions)
	// — every item in the group, representative's own `media` included, for
	// ListAdditionsCard's poster grid. Mutually exclusive with groupedLists.
	groupedMedia?: NonNullable<NotificationEntry["media"]>[];
	// Same media, added to several different lists the same day (see
	// groupSameDayMediaAdditions) — every list in the group, representative's
	// own `list` included, for MediaAdditionsCard's list-thumbnail grid.
	// Only ever populated for rows groupSameDayListAdditions didn't already
	// claim — a row belongs to at most one of groupedMedia/groupedLists.
	groupedLists?: NonNullable<NotificationEntry["list"]>[];
};

// Same fallback as asset-paths.ts's toPosterSrc for a posterPath-less media row.
const PLACEHOLDER_POSTER_SRC = "/posters/placeholder.jpg";

const NOTIFICATION_SELECT = {
	id: true,
	type: true,
	createdAt: true,
	readAt: true,
	list: { select: { id: true, title: true, thumbnail: true } },
	media: {
		select: {
			id: true,
			title: true,
			type: true,
			posterPath: true,
			externalId: true,
		},
	},
	message: true,
} as const;

// Same small pre-cached thumbnail activity-actions.ts's own toMediaEntry
// resolves, not /api/poster's full-size resolve — stays resolvable even for
// deleted media.
async function toMediaEntry(
	media: {
		id: number;
		title: string;
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
	return { id: media.id, title: media.title, posterSrc };
}

type RawNotification = {
	id: number;
	type: NotificationType;
	createdAt: Date;
	readAt: Date | null;
	list: { id: number; title: string; thumbnail: string | null } | null;
	media: {
		id: number;
		title: string;
		type: MediaType;
		posterPath: string | null;
		externalId: string | null;
	} | null;
	message: string | null;
};

// A same-day run of LIST_ITEM_ADDED rows sharing either a list (axis "list")
// or a media item (axis "media"), newest-first — members[0] is the
// representative NotificationEntry is built from. axis is unset for a group
// that never grew past its own single starting member.
type NotificationGroup = {
	members: RawNotification[];
	axis?: "list" | "media";
};

// Groups LIST_ITEM_ADDED rows for the same list on the same day, newest-first,
// so admin batches (or several separate adds) read as one ListAdditionsCard
// instead of a flood — same idea as activity-actions.ts's own same-day
// RATED/REVIEWED merge, just keyed by list+day instead of media.
function groupSameDayListAdditions(
	entries: RawNotification[],
): NotificationGroup[] {
	const grouped: NotificationGroup[] = [];
	const groupByKey = new Map<string, NotificationGroup>();

	for (const entry of entries) {
		const key =
			entry.type === "LIST_ITEM_ADDED" && entry.list
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

// Inverse of groupSameDayListAdditions: folds the same media item added to
// several different lists on the same day into one MediaAdditionsCard.
// Runs second and only over groups list-grouping left untouched (still a
// single member) — list-grouping always gets first claim on a row, so a row
// already absorbed into a list group never also joins a media group.
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
				return {
					...representative,
					media,
					readAt,
					groupedIds: rest.map((m) => m.id),
					groupedMedia,
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

// Takes a batch, not a single id — a single unread row is just a length-1
// call — so a grouped LIST_ITEM_ADDED row (see groupSameDayListAdditions)
// can mark every underlying notification it stands in for read with one click.
export async function markNotificationsRead(ids: number[]): Promise<void> {
	const userId = await requireUserId();
	// where: { id: { in: ids }, userId } rather than a plain { id } — a user can
	// only ever mark their own notifications read, same scoping requireAdmin's
	// server-action callers rely on elsewhere for their own rows.
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
