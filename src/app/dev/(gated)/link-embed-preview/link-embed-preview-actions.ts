"use server";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { toLinkEmbedImageSrc } from "@/server/resolvers/poster-resolver";
import { buildLinkEmbedDescription } from "@/app/media/[id]/link-embed-meta";

export type EmbedSearchResult = { id: number; title: string };

const EMBED_SEARCH_LIMIT = 20;

// Same fuzzy-match tolerance as crop-actions.ts's searchMediaForBanner.
const EMBED_FUSE_OPTIONS = { keys: ["title"], threshold: 0.35, ignoreLocation: true };

export async function searchMediaForEmbedPreview(
	query: string,
): Promise<EmbedSearchResult[]> {
	await requireAdmin();
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await db.media.findMany({
		select: { id: true, title: true },
		orderBy: { id: "desc" },
	});

	return fuzzySearch(candidates, EMBED_FUSE_OPTIONS, trimmed, EMBED_SEARCH_LIMIT);
}

// Skip-a-random-offset instead of ORDER BY random() — cheap at this table
// size and avoids a full-table sort on every click.
export async function getRandomEmbedTarget(): Promise<EmbedSearchResult | null> {
	await requireAdmin();

	const where = { posterPath: { not: null } };
	const count = await db.media.count({ where });
	if (count === 0) return null;

	const media = await db.media.findFirst({
		where,
		select: { id: true, title: true },
		skip: Math.floor(Math.random() * count),
	});
	return media;
}

export type EmbedPreview = {
	title: string;
	description: string | null;
	imageUrl: string | null;
	canonicalPath: string;
};

// Mirrors generateMediaMetadata (metadata.ts) exactly, via the same helpers.
export async function getEmbedPreview(mediaId: number): Promise<EmbedPreview | null> {
	await requireAdmin();

	const media = await db.media.findUnique({
		where: { id: mediaId },
		select: {
			title: true,
			overview: true,
			publicRating: true,
			posterPath: true,
			bannerPath: true,
			review: { select: { rating: true } },
		},
	});
	if (!media) return null;

	const embedSrc = toLinkEmbedImageSrc(mediaId, media.posterPath, media.bannerPath);
	return {
		title: media.title,
		description: buildLinkEmbedDescription(media) ?? null,
		// noCache so the dev tool always sees a freshly composited image, not
		// the disk/browser-cached one.
		imageUrl: embedSrc ? `${embedSrc}?noCache=1` : null,
		canonicalPath: `/media/${mediaId}`,
	};
}
