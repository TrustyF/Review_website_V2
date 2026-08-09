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
		select: {
			title: true,
			overview: true,
			posterPath: true,
			bannerPath: true,
			isDeleted: true,
		},
	});
	if (!media || media.isDeleted) return {};

	// JPEG, not the site's usual WebP poster, composited into the standard
	// 1200x630 og:image shape rather than just resized into it — see
	// toLinkEmbedImageSrc/resolveLinkEmbedImage's own comments on why.
	const linkEmbedImageUrl = toLinkEmbedImageSrc(
		mediaId,
		media.posterPath,
		media.bannerPath,
	);

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
