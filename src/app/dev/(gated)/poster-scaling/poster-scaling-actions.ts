"use server";
import sharp from "sharp";
import { db } from "@/server/db/client";
import { posterUrlFor } from "@/server/resolvers/poster-resolver";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { requireAdmin } from "@/lib/auth/require-admin";

export type ImageInfo = {
	sizeBytes: number;
	width: number;
	height: number;
};

export type PosterOption = {
	id: number;
	title: string;
	fullUrl: string;
	thumbUrl: string;
	ratio: string;
};

// MediaBrowser only hands back {id, title, type, posterSrc} — posterSrc is the app's own
// cached WebP, not enough to build the two origin-CDN URLs this playground compares.
export async function getPosterOption(mediaId: number): Promise<PosterOption | null> {
	await requireAdmin();

	const media = await db.media.findUnique({
		where: { id: mediaId },
		select: { id: true, title: true, type: true, externalId: true, posterPath: true },
	});
	if (!media?.posterPath) return null;

	return {
		id: media.id,
		title: media.title,
		fullUrl: posterUrlFor(media.type, media.externalId, media.posterPath, "full"),
		thumbUrl: posterUrlFor(media.type, media.externalId, media.posterPath, "thumb"),
		ratio: posterRatioFor(media.type),
	};
}

// Fetched server-side (not client fetch()) since most origins here (TMDB, IGDB,
// MangaDex) don't send CORS headers a browser fetch would need to read the body.
export async function getImageInfo(url: string): Promise<ImageInfo> {
	await requireAdmin();

	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to fetch image");
	const bytes = Buffer.from(await res.arrayBuffer());
	const metadata = await sharp(bytes).metadata();
	return {
		sizeBytes: bytes.byteLength,
		width: metadata.width ?? 0,
		height: metadata.height ?? 0,
	};
}
