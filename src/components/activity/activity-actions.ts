"use server";
import { db } from "@/server/db/client";
import { resolveChangelogPosterThumb } from "@/server/resolvers/poster-resolver";
import type { MediaType } from "@prisma/client";

// No dedicated ActivityLog table — every event is read live off its own source, so removing a row there removes it from this feed too.
export type ActivityType =
	| "RATED"
	| "RATING_CHANGED"
	| "REVIEWED"
	| "WATCHLIST_ADDED"
	| "LIST_CREATED"
	| "LIST_ITEM_ADDED"
	| "REWATCHED";

export type ActivityFeedEntry = {
	id: string;
	type: ActivityType;
	createdAt: Date;
	oldValue: string | null;
	newValue: string | null;
	media: {
		id: number;
		title: string;
		type: MediaType;
		posterSrc: string;
	} | null;
	list: { id: number; title: string; thumbnail: string | null } | null;
	// LIST_ITEM_ADDED row standing in for same-day additions (see notification-actions.ts's
	// own grouping, mirrored here). id/media/list/createdAt are from the most recent one.
	groupedIds?: string[];
	// Same list, or same RATED/REVIEWED/WATCHLIST_ADDED/REWATCHED type, on the same day.
	// `value` is that member's own newValue — only set for RATED/REVIEWED, null otherwise.
	groupedMedia?: (NonNullable<ActivityFeedEntry["media"]> & { value: string | null })[];
	// Same media added to multiple lists same day; only for entries unclaimed by list-grouping.
	groupedLists?: NonNullable<ActivityFeedEntry["list"]>[];
};

const PAGE_SIZE = 100;

// Same fallback as asset-paths.ts's toPosterSrc for a posterPath-less media row.
const PLACEHOLDER_POSTER_SRC = "/posters/placeholder.jpg";

// Rate-and-review on the same day should read as one combined moment, not two rows.
function isSameCalendarDay(a: Date, b: Date): boolean {
	return a.toDateString() === b.toDateString();
}

const MEDIA_SELECT = {
	id: true,
	title: true,
	type: true,
	posterPath: true,
	externalId: true,
} as const;

type MediaSelection = {
	id: number;
	title: string;
	type: MediaType;
	posterPath: string | null;
	externalId: string | null;
} | null;

// Same small cached thumbnail change-log rows use (stays resolvable for deleted media),
// not /api/poster's full-size resolve. posterSrcCache dedupes since one media can appear in several entries.
async function toMediaEntry(
	media: MediaSelection,
	posterSrcCache: Map<number, Promise<string>>,
): Promise<ActivityFeedEntry["media"]> {
	if (!media) return null;
	let posterSrc: Promise<string> | undefined;
	if (media.posterPath) {
		posterSrc = posterSrcCache.get(media.id);
		if (!posterSrc) {
			posterSrc = resolveChangelogPosterThumb(
				media.id,
				media.type,
				media.externalId,
				media.posterPath,
			);
			posterSrcCache.set(media.id, posterSrc);
		}
	}
	return {
		id: media.id,
		title: media.title,
		type: media.type,
		posterSrc: posterSrc ? await posterSrc : PLACEHOLDER_POSTER_SRC,
	};
}

type RawActivityEntry = Omit<ActivityFeedEntry, "media"> & { media: MediaSelection };

// Same-day entries sharing a list, media item, or activity type, newest-first (members[0]
// is representative). List/media mirrors notification-actions.ts's own grouping.
type ActivityGroup = {
	members: RawActivityEntry[];
	axis?: "list" | "media" | "type";
};

// Groups same-list additions by day; reads as one card, not flood.
function groupSameDayListAdditions(entries: RawActivityEntry[]): ActivityGroup[] {
	const grouped: ActivityGroup[] = [];
	const groupByKey = new Map<string, ActivityGroup>();

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

		const group: ActivityGroup = { members: [entry] };
		grouped.push(group);
		if (key) groupByKey.set(key, group);
	}

	return grouped;
}

// Inverse of list-grouping: same media to multiple lists. Runs second over unclaimed groups.
function groupSameDayMediaAdditions(groups: ActivityGroup[]): ActivityGroup[] {
	const result: ActivityGroup[] = [];
	const groupByKey = new Map<string, ActivityGroup>();

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

// Types that read fine as an anonymous poster grid (no per-item value shown once grouped) —
// RATING_CHANGED's old→new pair and LIST_ITEM_ADDED's own list already handle themselves.
const TYPE_GROUPABLE = new Set<ActivityType>([
	"RATED",
	"REVIEWED",
	"WATCHLIST_ADDED",
	"REWATCHED",
]);

// Same-day entries of the same activity type; runs last over whatever list/media-grouping
// didn't claim (those only ever match LIST_ITEM_ADDED, so nothing here overlaps them).
function groupSameDayByType(groups: ActivityGroup[]): ActivityGroup[] {
	const result: ActivityGroup[] = [];
	const groupByKey = new Map<string, ActivityGroup>();

	for (const group of groups) {
		if (group.members.length > 1) {
			result.push(group);
			continue;
		}

		const entry = group.members[0]!;
		const key = TYPE_GROUPABLE.has(entry.type)
			? `${entry.type}-${entry.createdAt.toDateString()}`
			: null;
		const existing = key ? groupByKey.get(key) : undefined;

		if (existing) {
			existing.members.push(entry);
			existing.axis = "type";
			continue;
		}

		result.push(group);
		if (key) groupByKey.set(key, group);
	}

	return result;
}

// Most-recent-first, capped not paginated. Each source query is capped/sorted independently,
// not re-capped globally, so high-volume RATED can't crowd out sparse REVIEWED after merging.
export async function getActivityFeed(): Promise<ActivityFeedEntry[]> {
	const [
		ratedReviews,
		reviewedReviews,
		ratingChanges,
		rewatches,
		lists,
		listItems,
		watchlistItems,
	] = await Promise.all([
			// RATED — every review has this, since a rating is required to save one.
			db.review.findMany({
				where: { media: { isAdult: false, isDeleted: false } },
				orderBy: { createDate: "desc" },
				take: PAGE_SIZE,
				select: {
					mediaId: true,
					createDate: true,
					rating: true,
					initialRating: true,
					media: { select: MEDIA_SELECT },
				},
			}),
			// REVIEWED — reviewDate marks a separate, later moment (first time a body
			// gets written), so it's ranked/capped by its own date, not ratedReviews'.
			db.review.findMany({
				where: {
					reviewDate: { not: null },
					media: { isAdult: false, isDeleted: false },
				},
				orderBy: { reviewDate: "desc" },
				take: PAGE_SIZE,
				select: {
					mediaId: true,
					reviewDate: true,
					createDate: true,
					rating: true,
					initialRating: true,
					media: { select: MEDIA_SELECT },
				},
			}),
			db.mediaChangeLog.findMany({
				where: {
					field: "rating",
					deletedAt: null,
					media: { isAdult: false, isDeleted: false },
				},
				orderBy: { createdAt: "desc" },
				take: PAGE_SIZE,
				select: {
					id: true,
					mediaId: true,
					oldValue: true,
					newValue: true,
					createdAt: true,
					media: { select: MEDIA_SELECT },
				},
			}),
			// REWATCHED — a real MediaChangeLog row, unlike RATED/REVIEWED's synthetic ones.
			db.mediaChangeLog.findMany({
				where: {
					field: "rewatched",
					deletedAt: null,
					media: { isAdult: false, isDeleted: false },
				},
				orderBy: { createdAt: "desc" },
				take: PAGE_SIZE,
				select: {
					id: true,
					mediaId: true,
					createdAt: true,
					media: { select: MEDIA_SELECT },
				},
			}),
			// targetUserId: null — a recommendation list is private to whoever it's for,
			// so it (and anything added to it) shouldn't surface on this public feed.
			db.list.findMany({
				where: { targetUserId: null },
				orderBy: { createDate: "desc" },
				take: PAGE_SIZE,
				select: { id: true, title: true, thumbnail: true, createDate: true },
			}),
			db.listItem.findMany({
				where: {
					media: { isAdult: false, isDeleted: false },
					list: { targetUserId: null },
				},
				orderBy: { addedAt: "desc" },
				take: PAGE_SIZE,
				select: {
					listId: true,
					addedAt: true,
					list: { select: { id: true, title: true, thumbnail: true } },
					media: { select: MEDIA_SELECT },
				},
			}),
			db.watchlistItem.findMany({
				where: {
					user: { role: "ADMIN" },
					media: { isAdult: false, isDeleted: false },
				},
				orderBy: { addedAt: "desc" },
				take: PAGE_SIZE,
				select: {
					userId: true,
					mediaId: true,
					addedAt: true,
					media: { select: MEDIA_SELECT },
				},
			}),
		]);

	// Same-day tiebreak: REVIEWED (more specific) wins and RATED is dropped.
	const sameDayReviewedMediaIds = new Set(
		reviewedReviews
			.filter((review) => isSameCalendarDay(review.reviewDate!, review.createDate))
			.map((review) => review.mediaId),
	);

	const entries: RawActivityEntry[] = [
		...ratedReviews
			.filter((review) => !sameDayReviewedMediaIds.has(review.mediaId))
			.map((review) => {
				// initialRating is what was actually given at the time; falls back to the
				// live `rating` only for a pre-backfill row that never got one.
				const rating = review.initialRating ?? review.rating;
				return {
					id: `rated-${review.mediaId}`,
					type: "RATED" as const,
					createdAt: review.createDate,
					oldValue: null,
					newValue: rating == null ? null : String(rating),
					media: review.media,
					list: null,
				};
			}),
		...reviewedReviews.map((review) => {
			// Same rating value RATED shows, just folded into this entry instead of a
			// separate RATED row when the same-day tiebreak drops it.
			const rating = review.initialRating ?? review.rating;
			return {
				id: `reviewed-${review.mediaId}`,
				type: "REVIEWED" as const,
				createdAt: review.reviewDate!,
				oldValue: null,
				newValue: rating == null ? null : String(rating),
				media: review.media,
				list: null,
			};
		}),
		...ratingChanges.map((change) => ({
			id: `rating-${change.id}`,
			type: "RATING_CHANGED" as const,
			createdAt: change.createdAt,
			oldValue: change.oldValue,
			newValue: change.newValue,
			media: change.media,
			list: null,
		})),
		...rewatches.map((rewatch) => ({
			id: `rewatch-${rewatch.id}`,
			type: "REWATCHED" as const,
			createdAt: rewatch.createdAt,
			oldValue: null,
			newValue: null,
			media: rewatch.media,
			list: null,
		})),
		...lists.map((list) => ({
			id: `list-${list.id}`,
			type: "LIST_CREATED" as const,
			createdAt: list.createDate,
			oldValue: null,
			newValue: null,
			media: null,
			list: { id: list.id, title: list.title, thumbnail: list.thumbnail },
		})),
		...listItems.map((item) => ({
			id: `listitem-${item.listId}-${item.media.id}`,
			type: "LIST_ITEM_ADDED" as const,
			createdAt: item.addedAt,
			oldValue: null,
			newValue: null,
			media: item.media,
			list: item.list,
		})),
		...watchlistItems.map((item) => ({
			id: `watchlist-${item.userId}-${item.mediaId}`,
			type: "WATCHLIST_ADDED" as const,
			createdAt: item.addedAt,
			oldValue: null,
			newValue: null,
			media: item.media,
			list: null,
		})),
	];

	entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	const groups = groupSameDayByType(
		groupSameDayMediaAdditions(groupSameDayListAdditions(entries)),
	);

	const posterSrcCache = new Map<number, Promise<string>>();
	return Promise.all(
		groups.map(async ({ members, axis }): Promise<ActivityFeedEntry> => {
			// members is always non-empty (grouping always starts a group with
			// the entry that created it).
			const [representative, ...rest] = members as [
				RawActivityEntry,
				...RawActivityEntry[],
			];
			const media = await toMediaEntry(representative.media, posterSrcCache);

			if (rest.length === 0) {
				return { ...representative, media };
			}

			if (axis === "list" || axis === "type") {
				const groupedMedia = (
					await Promise.all(
						members.map(async (m) => {
							const mediaEntry = await toMediaEntry(m.media, posterSrcCache);
							if (!mediaEntry) return null;
							const value = m.type === "RATED" || m.type === "REVIEWED" ? m.newValue : null;
							return { ...mediaEntry, value };
						}),
					)
				).filter((m) => m !== null);
				return {
					...representative,
					media,
					groupedIds: rest.map((m) => m.id),
					groupedMedia,
				};
			}

			const groupedLists = members.map((m) => m.list).filter((l) => l !== null);
			return {
				...representative,
				media,
				groupedIds: rest.map((m) => m.id),
				groupedLists,
			};
		}),
	);
}
