import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { resolveBanner } from "@/server/resolvers/poster-resolver";

// Same lazy-resolve-on-request pattern as /api/poster (see that route for
// the full reasoning) — toMediaRecord builds this URL with zero I/O, and
// the actual download/cache only happens here, on whichever request
// actually asks for it. [filename] itself isn't read; it only exists to
// content-address the URL (see mediaAssetFilename) so the long-lived
// immutable Cache-Control below is safe.
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
		select: { type: true, bannerPath: true },
	});
	if (!media) {
		return NextResponse.json({ error: "Media not found" }, { status: 404 });
	}

	const localPath = await resolveBanner(id, media.type, media.bannerPath);
	if (!localPath) {
		return NextResponse.json({ error: "No banner for this media" }, { status: 404 });
	}

	const bytes = await readFile(path.join(process.cwd(), "public", localPath));

	return new NextResponse(bytes, {
		headers: {
			"Content-Type": "image/webp",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
