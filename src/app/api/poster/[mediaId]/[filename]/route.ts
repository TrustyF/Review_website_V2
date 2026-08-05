import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { resolvePoster } from "@/server/resolvers/poster-resolver";

// The lazy counterpart to resolvePoster: toMediaRecord builds this URL for
// every card without touching disk or network, so a whole list page renders
// instantly regardless of poster-cache state. The actual resolve-or-download
// only happens here, the moment a browser requests this specific image —
// which for an off-screen card (next/image defaults to loading="lazy")
// might not be for a while, or ever. That's what spreads a from-empty-cache
// page load's downloads out over scrolling instead of firing every poster
// on the page as one burst (see purge/cleanup scripts for what previously
// happened: dozens of concurrent fetches to the same remote host at once).
//
// [filename] itself isn't read — it only exists so the URL is content-
// addressed by posterPath (see posterFilename), the same way the on-disk
// cache path is. That's what makes the long-lived immutable Cache-Control
// below safe: the URL changes the moment the poster does.
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
		select: { type: true, externalId: true, posterPath: true },
	});
	if (!media) {
		return NextResponse.json({ error: "Media not found" }, { status: 404 });
	}

	const localPath = await resolvePoster(
		id,
		media.type,
		media.externalId,
		media.posterPath,
	);
	const bytes = await readFile(path.join(process.cwd(), "public", localPath));

	return new NextResponse(bytes, {
		headers: {
			"Content-Type": localPath.endsWith(".webp") ? "image/webp" : "image/jpeg",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
