import { cache } from "react";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { resolvePoster } from "@/server/resolvers/poster-resolver";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";

// Tagged cache (same pattern as get-media.ts) so admin edits invalidate it immediately via revalidateMediaPaths; 1-hour revalidate as a safety net.
const getPosterMedia = cache((id: number) =>
	unstable_cache(
		() =>
			db.media.findUnique({
				where: { id },
				select: { type: true, externalId: true, posterPath: true, isDeleted: true },
			}),
		["poster-route-media", String(id)],
		{ tags: [mediaCacheTag(id)], revalidate: 3600 },
	)(),
);

// Lazy resolve-or-download, only on actual image request (not page render), so lazy-loaded/off-screen posters don't all fetch at once.
// [filename] is unused — it only content-addresses the URL by posterPath, which is what makes the immutable Cache-Control below safe.
export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ mediaId: string }> },
) {
	const { mediaId } = await params;
	const id = Number(mediaId);
	if (!Number.isFinite(id)) {
		return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
	}

	const media = await getPosterMedia(id);
	if (!media) {
		return NextResponse.json({ error: "Media not found" }, { status: 404 });
	}
	// Soft-deleted media's bytes stay admin-only.
	if (media.isDeleted) {
		const session = await auth();
		if (session?.user?.role !== "ADMIN") {
			return NextResponse.json({ error: "Media not found" }, { status: 404 });
		}
	}

	const resolved = await resolvePoster(
		id,
		media.type,
		media.externalId,
		media.posterPath,
	);

	// Cast works around TS 5.9 + @types/node v20 friction; Buffer is a valid Response body at runtime.
	return new NextResponse(resolved.bytes as BodyInit, {
		headers: {
			"Content-Type": resolved.contentType,
			// `fresh` means raw, not-yet-compressed bytes — must not be cached as immutable since the re-encoded WebP lands moments later via `after()`.
			"Cache-Control": resolved.fresh
				? "no-store"
				: "public, max-age=31536000, immutable",
		},
	});
}
