import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { resolveLinkEmbedImage } from "@/server/resolvers/poster-resolver";

// Same lazy resolve-or-download shape as /api/poster; a separate route since this serves JPEG bytes, not the WebP /api/poster serves.
export async function GET(
	req: Request,
	{ params }: { params: Promise<{ mediaId: string }> },
) {
	const { mediaId } = await params;
	const id = Number(mediaId);
	// Dev-only escape hatch (link-embed-preview tool) to bypass both the disk cache and browser caching while experimenting.
	const noCache = new URL(req.url).searchParams.has("noCache");
	if (!Number.isFinite(id)) {
		return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
	}

	const media = await db.media.findUnique({
		where: { id },
		select: {
			type: true,
			externalId: true,
			posterPath: true,
			isDeleted: true,
		},
	});
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

	const resolved = await resolveLinkEmbedImage(
		id,
		media.type,
		media.externalId,
		media.posterPath,
		noCache,
	);
	if (!resolved) {
		return NextResponse.json({ error: "No poster for this media" }, { status: 404 });
	}

	// Same TS 5.9 + @types/node v20 cast friction as /api/poster — not a real mismatch.
	return new NextResponse(resolved.bytes as BodyInit, {
		headers: {
			"Content-Type": resolved.contentType,
			"Cache-Control": noCache
				? "no-store"
				: "public, max-age=31536000, immutable",
		},
	});
}
