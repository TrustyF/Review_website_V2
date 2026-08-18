import { cache } from "react";
import { db } from "@/server/db/client";

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

export const getMediaCore = cache((mediaId: number) =>
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
);

export const getMediaCredits = cache((mediaId: number) =>
	db.credit.findMany({
		where: { mediaId },
		include: { person: true, company: true, role: true },
		orderBy: { order: "asc" },
	}),
);

export const getMediaChangeLog = cache((mediaId: number) =>
	db.mediaChangeLog.findMany({
		where: { mediaId },
		orderBy: { createdAt: "desc" },
	}),
);
