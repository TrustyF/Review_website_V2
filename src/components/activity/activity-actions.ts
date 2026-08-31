"use server";
import { db } from "@/server/db/client";
import { resolveChangelogPosterThumb } from "@/server/resolvers/poster-resolver";
import type { MediaType } from "@prisma/client";

// No dedicated ActivityLog table — every event is read live off its own source
// (Review, MediaChangeLog, List, ListItem/WatchlistItem), so removing a row
// there removes it from this feed too, with nothing to keep in sync.
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
	list: { id: number; title: string } | null;
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

// Same small pre-cached thumbnail change-log rows use, not /api/poster's full-size
// resolve — stays resolvable even for deleted media. posterSrcCache dedupes by media
// id since the same media often shows up under several entries in one feed.
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

// Most-recent-first, capped rather than paginated — activity volume never gets deep
// enough to need it. Public (no requireAdmin), but scoped to admin-authored rows:
// reviews/ratings/lists have no per-user owner, and WATCHLIST_ADDED is explicitly
// filtered to `user.role: ADMIN` so this reads as "my activity", not every visitor's.
// Media-referencing queries filter adult/soft-deleted directly on their own `where`
// since dbPublic only patches top-level `db.media.*`, not a nested `media: {...}` select.
//
// Each source query is capped and sorted independently, NOT re-capped globally after
// merging — RATED fires far more often than REVIEWED, and a single global cap would let
// it crowd sparse types out even when they're recent.
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
				select: { id: true, title: true, createDate: true },
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
					list: { select: { id: true, title: true } },
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

	const entries: (Omit<ActivityFeedEntry, "media"> & { media: MediaSelection })[] = [
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
			list: { id: list.id, title: list.title },
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

	const posterSrcCache = new Map<number, Promise<string>>();
	return Promise.all(
		entries.map(async (entry) => ({
			...entry,
			media: await toMediaEntry(entry.media, posterSrcCache),
		})),
	);
}
