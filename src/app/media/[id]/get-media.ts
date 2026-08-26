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

export const getMediaCore = cache((mediaId: number) =>
	unstable_cache(
		() =>
			db.media.findUnique({
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
			}),
		["media-core", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)(),
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

export const getMediaChangeLog = cache((mediaId: number) =>
	unstable_cache(
		() =>
			db.mediaChangeLog.findMany({
				where: { mediaId },
				orderBy: { createdAt: "desc" },
			}),
		["media-change-log", String(mediaId)],
		{ tags: [mediaCacheTag(mediaId)], revalidate: 3600 },
	)(),
);
