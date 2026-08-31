import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { resolveBanner } from "@/server/resolvers/poster-resolver";

// Same lazy-resolve-on-request pattern as /api/poster. [filename] is unused, only content-addressing the URL so the immutable Cache-Control below is safe.
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
		select: { type: true, bannerPath: true, isDeleted: true },
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

	const resolved = await resolveBanner(id, media.type, media.bannerPath);
	if (!resolved) {
		return NextResponse.json(
			{ error: "No banner for this media" },
			{ status: 404 },
		);
	}

	// Cast works around TS 5.9 + @types/node v20 friction, not a real mismatch.
	return new NextResponse(resolved.bytes as BodyInit, {
		headers: {
			"Content-Type": resolved.contentType,
			// `fresh` means raw, uncompressed bytes — not immutable-cacheable, since the compressed version lands moments later via `after()`.
			"Cache-Control": resolved.fresh
				? "no-store"
				: "public, max-age=31536000, immutable",
		},
	});
}
