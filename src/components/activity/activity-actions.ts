"use server";
import { db } from "@/server/db/client";
import { resolveChangelogPosterThumb } from "@/server/resolvers/poster-resolver";
import type { MediaType } from "@prisma/client";

// No dedicated ActivityLog table — every one of these is already recorded
// somewhere with its own timestamp (Review.createDate, MediaChangeLog's
// "rating" rows, List.createDate, ListItem/WatchlistItem.addedAt), and a
// row disappearing from its source (removed from a list/watchlist, a
// change-log entry hidden via deleteChangeLogEntry) is exactly the same
// thing as it disappearing from this feed — no separate log to keep in
// sync, no backfill needed when a new kind of event is added later.
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

// Same fallback asset-paths.ts's toPosterSrc uses for a posterPath-less
// media row — kept local since this is the one place that ternary needed
// duplicating rather than importing the whole helper just for this constant.
const PLACEHOLDER_POSTER_SRC = "/posters/placeholder.jpg";

// Same "skip if it lands the same calendar day as the rating" rule
// change-log-list.tsx's synthesized "Reviewed on" entry uses against
// "Watched on" — the two reading as one combined moment (rate and review in
// the same sitting) rather than two separate feed rows for it.
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

// Same content-addressed change-log thumbnail every media editor's own
// changelog uses (see change-log-list.tsx's ChangeValue) rather than
// /api/poster's full-size lazy resolve — a small, pre-cached image is the
// right weight for a dense feed row, and it's the one poster source that
// keeps resolving correctly even for media that's since been deleted.
async function toMediaEntry(media: MediaSelection): Promise<ActivityFeedEntry["media"]> {
	if (!media) return null;
	return {
		id: media.id,
		title: media.title,
		type: media.type,
		posterSrc: media.posterPath
			? await resolveChangelogPosterThumb(
					media.id,
					media.type,
					media.externalId,
					media.posterPath,
				)
			: PLACEHOLDER_POSTER_SRC,
	};
}

// Most-recent-first, capped rather than paginated — a personal site's
// activity volume never gets deep enough for pagination to earn its keep
// (see list-actions.ts's own searchMediaForList comment on the same
// small-scale tradeoff). Public — no requireAdmin() here — but scoped to
// admin-authored rows only: reviews/ratings/lists have no per-user owner at
// all (only an admin can ever write them), but WATCHLIST_ADDED needs an
// explicit `user.role: ADMIN` filter since watchlist is genuinely per-user
// — this is meant to read as "my activity", not a public log of what every
// visitor's account has been doing. Every media-referencing query also
// excludes adult/soft-deleted media directly on its own `where`, rather
// than going through dbPublic — that extension (src/server/db/client.ts)
// only patches top-level `db.media.*` calls, not a nested `media: {...}`
// select off another model the way every query below does, so it wouldn't
// actually filter anything here even if used. isAdult isn't wired into it
// at all yet either (see that field's own comment in media.prisma).
//
// Each source query takes its own PAGE_SIZE, capped and sorted by that
// source's own date column — deliberately NOT re-capped to PAGE_SIZE again
// after merging. RATED fires on every review save (1400+ of them) while
// REVIEWED only fires the rare times a body actually got written (a few
// dozen, ever) — a single global top-PAGE_SIZE slice across every type
// combined would let the high-frequency type permanently crowd the sparse
// one out the moment more than PAGE_SIZE ratings happened since the last
// review was written up, however recent that review still is. Each type
// keeping its own independently-capped window avoids that regardless of how
// unevenly the types fire.
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
			// RATED — every review has this, since a rating is required to save
			// one at all (see saveReview). Excludes adult/soft-deleted media —
			// this feed is public (see the comment below), unlike the review/
			// media editor itself.
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
			// REVIEWED — a separate, later moment reviewDate marks (set once,
			// the first time body actually goes from unset to set — see
			// saveReview's own comment), not every review has one. Ranked and
			// capped by its own date rather than reused from ratedReviews above,
			// same reasoning as RATING_CHANGED's own separate query: a review
			// rated long ago but only just written up needs to rank by when it
			// was reviewed, not when it was rated.
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
			// REWATCHED — a real MediaChangeLog row, unlike RATED/REVIEWED's
			// synthetic ones (see logRewatch), so it's filtered/capped the same
			// way RATING_CHANGED's own query above is.
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
			db.list.findMany({
				orderBy: { createDate: "desc" },
				take: PAGE_SIZE,
				select: { id: true, title: true, createDate: true },
			}),
			db.listItem.findMany({
				where: { media: { isAdult: false, isDeleted: false } },
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

	// When both land the same calendar day (rate and review in one sitting),
	// REVIEWED wins and RATED is dropped rather than the other way around —
	// "reviewed" is the more specific, more informative event of the two, so
	// it's the one that should represent that day, not just whichever of the
	// two happened to be checked first.
	const sameDayReviewedMediaIds = new Set(
		reviewedReviews
			.filter((review) => isSameCalendarDay(review.reviewDate!, review.createDate))
			.map((review) => review.mediaId),
	);

	const entries: (Omit<ActivityFeedEntry, "media"> & { media: MediaSelection })[] = [
		...ratedReviews
			.filter((review) => !sameDayReviewedMediaIds.has(review.mediaId))
			.map((review) => {
				// initialRating is what was actually given at the time (see its
				// own comment in rating.prisma) — falls back to the live `rating`
				// only for the unreachable-post-backfill case of a row that
				// somehow never got one.
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
			// Same originally-given-rating value RATED shows (see its own
			// comment above) — REVIEWED winning the same-day tiebreak
			// shouldn't mean the rating itself goes unshown, just that it's
			// folded into this one entry instead of a separate RATED row.
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

	return Promise.all(
		entries.map(async (entry) => ({ ...entry, media: await toMediaEntry(entry.media) })),
	);
}
