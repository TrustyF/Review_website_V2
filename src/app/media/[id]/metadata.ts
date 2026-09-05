import type { Metadata } from "next";
import { getMediaCore } from "./get-media";
import { toLinkEmbedImageSrc } from "@/server/resolvers/poster-resolver";
import { buildLinkEmbedDescription } from "./link-embed-meta";

// Split out of page.tsx (Next only needs the export re-exported, not co-located).
// Reuses page.tsx's React.cache-wrapped getMediaCore so this and the page share one DB round trip per request.
export async function generateMediaMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const mediaId = Number(id);
	if (!Number.isFinite(mediaId)) return {};

	const media = await getMediaCore(mediaId);
	if (!media || media.isDeleted) return {};

	// JPEG composited into the standard 1200x630 og:image shape, not just resized — see toLinkEmbedImageSrc's own comment.
	const linkEmbedImageUrl = toLinkEmbedImageSrc(mediaId, media.posterPath);

	const description = buildLinkEmbedDescription(media);

	return {
		title: media.title,
		description,
		openGraph: {
			title: media.title,
			description,
			images: linkEmbedImageUrl
				? [{ url: linkEmbedImageUrl, width: 1200, height: 630 }]
				: undefined,
		},
	};
}
