import type { Metadata } from "next";
import { getMediaCore } from "./get-media";
import { toLinkEmbedImageSrc } from "@/server/resolvers/poster-resolver";
import { buildLinkEmbedDescription } from "./link-embed-meta";

// Kept out of page.tsx (already a long file) — Next only needs a
// `generateMetadata` export from that file, it doesn't care whether the
// function itself lives there or is re-exported from here. Uses page.tsx's
// own getMediaCore (React.cache-wrapped) rather than a separate lighter
// query — generateMetadata and the page component both run for the same
// request, so calling the same cached function here means only one round
// trip to the (remote) DB happens between the two, instead of each paying
// its own. Only ever reads title/overview/poster/banner, all of which live
// on the core row — never needs credits or changeLog.
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

	// JPEG, not the site's usual WebP poster — link-preview crawlers need
	// JPEG/PNG reliably. See toLinkEmbedImageSrc/resolveLinkEmbedImage.
	const linkEmbedImageUrl = toLinkEmbedImageSrc(mediaId, media.posterPath);

	const description = buildLinkEmbedDescription(media);

	return {
		title: media.title,
		description,
		openGraph: {
			title: media.title,
			description,
			// No explicit width/height — the poster's aspect ratio varies by
			// title, unlike the fixed-shape og:image this used to composite.
			images: linkEmbedImageUrl ? [{ url: linkEmbedImageUrl }] : undefined,
		},
	};
}
