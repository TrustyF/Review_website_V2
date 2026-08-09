import type { Metadata } from "next";
import { db } from "@/server/db/client";
import { toLinkEmbedImageSrc } from "@/server/resolvers/poster-resolver";

// Kept out of page.tsx (already a long file) — Next only needs a
// `generateMetadata` export from that file, it doesn't care whether the
// function itself lives there or is re-exported from here. Deliberately a
// separate, lighter query rather than reusing page.tsx's own (which pulls
// in credits/changeLog/every type-specific relation) — this only ever
// needs title/overview/poster.
export async function generateMediaMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const mediaId = Number(id);
	if (!Number.isFinite(mediaId)) return {};

	const media = await db.media.findUnique({
		where: { id: mediaId },
		select: { title: true, overview: true, posterPath: true, isDeleted: true },
	});
	if (!media || media.isDeleted) return {};

	// JPEG, not the site's usual WebP poster — Discord and WhatsApp's
	// crawlers don't reliably render WebP for og:image (see
	// toLinkEmbedImageSrc). Same 2:3 poster crop as on-site for now; a
	// proper 1200x630 crop for the preview card's own aspect ratio is a
	// separate follow-up.
	const linkEmbedImageUrl = toLinkEmbedImageSrc(mediaId, media.posterPath);

	return {
		title: media.title,
		description: media.overview ?? undefined,
		openGraph: {
			title: media.title,
			description: media.overview ?? undefined,
			images: linkEmbedImageUrl ? [{ url: linkEmbedImageUrl }] : undefined,
		},
	};
}
