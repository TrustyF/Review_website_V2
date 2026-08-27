import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db/client";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";

// Split into three independent, React.cache-wrapped queries rather than one
// big findUnique with every relation included — page.tsx only needs
// getMediaCore to render its banner/title/facts/review, and wraps the
// credits- and change-log-dependent parts of the page in their own
// <Suspense> boundaries (see credits-section.tsx/change-log-section.tsx), so
// a slow credits or change-log query no longer blocks everything else from
// rendering. Each is still React.cache-wrapped for the same reason the
// original getMedia was: multiple call sites within one request (the title
// row's director credit and the Details section's cast/studio/credits list
// both call getMediaCredits) share one query instead of each paying their
// own round trip.
//
// The page itself (page.tsx) can't be static — it awaits auth() to decide
// admin-only soft-delete visibility and the watchlist button — so it's
// always ƒ Dynamic per `next build`'s own route summary. These three
// queries are what's actually expensive (a remote Postgres round trip
// each), so they're the thing worth caching across requests rather than
// just within one: unstable_cache persists each across every viewer until
// revalidateMediaPaths's revalidateTag(mediaCacheTag(mediaId)) call fires
// (every admin edit already goes through it). The 1-hour revalidate
// alongside that tag exists only as a safety net for enrich-db.ts, which
// updates this same data from a separate cron process that has no way to
// call revalidateTag on the deployed app — same reasoning as
// invalidateSearchIndex's own 1-hour TTL (see search-actions.ts) for the
// same problem.

function queryMediaCore(mediaId: number) {
	return db.media.findUnique({
		where: { id: mediaId },
		include: {
			movie: true,
			tvShow: true,
			manga: true,
			comic: true,
			game: true,
			book: true,
			review: true,
			originCountry: true,
		},
	});
}

type MediaCore = Awaited<ReturnType<typeof queryMediaCore>>;

// unstable_cache persists its return value as JSON so it survives across
// requests/instances — JSON has no Date type, so every DateTime column below
// comes back as a plain ISO string on a cache hit, despite Prisma's (and
// this function's) own type still saying Date. Revived once here, right
// where the data exits the cache, so everything downstream — toMediaRecord,
// page components, and anything that crosses into a Client Component from
// there — can keep trusting a real Date instead of each formatting call
// site defensively re-coercing it. Only Media and Review carry DateTime
// columns among getMediaCore's included relations (see schema/media.prisma,
// schema/rating.prisma, schema/country.prisma, schema/crew.prisma) — nothing
// else here needs reviving.
function reviveMediaCoreDates(media: MediaCore): MediaCore {
	if (!media) return media;
	return {
		...media,
		releaseDate: media.releaseDate ? new Date(media.releaseDate) : null,
		createDate: media.createDate ? new Date(media.createDate) : null,
		updateDate: media.updateDate ? new Date(media.updateDate) : null,
		lastEnrichedAt: media.lastEnrichedAt ? new Date(media.lastEnrichedAt) : null,
		review: media.review && {
			...media.review,
			reviewDate: media.review.reviewDate
				? new Date(media.review.reviewDate)
				: null,
			createDate: new Date(media.review.createDate),
			updateDate: media.review.updateDate
				? new Date(media.review.updateDate)
				: null,
		},
	};
}

export const getMediaCore = cache((mediaId: number) =>
	unstable_cache(
		() => queryMediaCore(mediaId),
		["media-core", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)().then(reviveMediaCoreDates),
);

export const getMediaCredits = cache((mediaId: number) =>
	unstable_cache(
		() =>
			db.credit.findMany({
				where: { mediaId },
				include: { person: true, company: true, role: true },
				orderBy: { order: "asc" },
			}),
		["media-credits", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)(),
);

function queryMediaChangeLog(mediaId: number) {
	return db.mediaChangeLog.findMany({
		where: { mediaId },
		orderBy: { createdAt: "desc" },
	});
}

type MediaChangeLogRow = Awaited<ReturnType<typeof queryMediaChangeLog>>[number];

// Same JSON-round-trip problem as reviveMediaCoreDates above — see its own
// comment.
function reviveMediaChangeLogDates(
	rows: MediaChangeLogRow[],
): MediaChangeLogRow[] {
	return rows.map((row) => ({
		...row,
		createdAt: new Date(row.createdAt),
		deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
	}));
}

export const getMediaChangeLog = cache((mediaId: number) =>
	unstable_cache(
		() => queryMediaChangeLog(mediaId),
		["media-change-log", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)().then(reviveMediaChangeLogDates),
);
