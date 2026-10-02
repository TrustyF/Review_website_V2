import type { Metadata } from "next";
import { getMediaCore } from "./get-media";
import { toLinkEmbedImageSrc } from "@/server/resolvers/poster-resolver";
import { buildLinkEmbedDescription } from "./link-embed-meta";
import { SITE_URL } from "@/lib/site-url";
import { getLocale } from "@/lib/i18n/get-locale";

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

	const [media, locale] = await Promise.all([
		getMediaCore(mediaId),
		getLocale(),
	]);
	if (!media || media.isDeleted) return {};
	// Same fallback as the page's <Title>.
	const title = locale === "fr" ? (media.titleFr ?? media.title) : media.title;

	// JPEG composited into the standard 1200x630 og:image shape, not just resized — see toLinkEmbedImageSrc's own comment.
	const linkEmbedImageUrl = toLinkEmbedImageSrc(mediaId, media.posterPath);

	const description = buildLinkEmbedDescription(media);

	return {
		title,
		description,
		alternates: { canonical: `${SITE_URL}/media/${mediaId}` },
		openGraph: {
			title,
			description,
			images: linkEmbedImageUrl
				? [{ url: linkEmbedImageUrl, width: 1200, height: 630 }]
				: undefined,
		},
	};
}
