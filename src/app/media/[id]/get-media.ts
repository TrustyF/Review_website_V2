import { cache } from "react";
import { db } from "@/server/db/client";

// Wrapped in React.cache so page.tsx and metadata.ts's generateMetadata —
// which both run for the same request — share this one query instead of
// each paying their own round trip to the (remote, Neon) DB. Pulls in every
// relation both callers could ever want; generateMetadata only reads
// title/overview/poster/banner off the result, but since this is the same
// cache key as the page's own call, fetching more here costs nothing extra
// once dedup kicks in.
export const getMedia = cache((mediaId: number) =>
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
			credits: {
				include: { person: true, company: true, role: true },
				orderBy: { order: "asc" },
			},
			changeLog: { orderBy: { createdAt: "desc" } },
		},
	}),
);
