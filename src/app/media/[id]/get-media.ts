import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db/client";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";

// Split into three React.cache queries enabling Suspense boundaries.
// unstable_cache persists across viewers until admin edit triggers revalidateTag().

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

// unstable_cache persists return value as JSON (losing Date type), so revive here.
// Only Media and Review carry DateTime columns needing this.
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
