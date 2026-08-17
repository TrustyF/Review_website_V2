import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { resolveLinkEmbedImage } from "@/server/resolvers/poster-resolver";

// Same lazy resolve-or-download shape as /api/poster (see that route's own
// comment) — separate route rather than a query param on /api/poster
// because the two serve genuinely different bytes (JPEG here, WebP there),
// not just different Cache-Control/headers on the same file. See
// resolveLinkEmbedImage for why this needs its own JPEG-encoded cache at all.
export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ mediaId: string }> },
) {
	const { mediaId } = await params;
	const id = Number(mediaId);
	if (!Number.isFinite(id)) {
		return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
	}

	const media = await db.media.findUnique({
		where: { id },
		select: {
			type: true,
			externalId: true,
			posterPath: true,
			bannerPath: true,
			isDeleted: true,
		},
	});
	if (!media) {
		return NextResponse.json({ error: "Media not found" }, { status: 404 });
	}
	// Soft-deleted media's bytes stay admin-only — see the /media/[id] page's
	// own gate for the matching restore-flow reasoning.
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
		media.bannerPath,
	);
	if (!resolved) {
		return NextResponse.json({ error: "No poster for this media" }, { status: 404 });
	}

	// Same TS 5.9 + @types/node v20 friction as /api/poster's own cast — not
	// a real mismatch, a Buffer/Uint8Array has always been a valid Response
	// body at runtime.
	return new NextResponse(resolved.bytes as BodyInit, {
		headers: {
			"Content-Type": resolved.contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
