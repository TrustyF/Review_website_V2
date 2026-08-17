import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
		select: { type: true, externalId: true, posterPath: true, isDeleted: true },
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

	const resolved = await resolvePoster(
		id,
		media.type,
		media.externalId,
		media.posterPath,
	);

	// The cast is a known TS 5.9 + @types/node v20 friction (generic typed-
	// array vs. lib.dom's BodyInit union), not a real mismatch — a Buffer/
	// Uint8Array has always been a valid Response body at runtime.
	return new NextResponse(resolved.bytes as BodyInit, {
		headers: {
			"Content-Type": resolved.contentType,
			// Same reasoning as the /api/banner route: a `fresh` response is the
			// raw, not-yet-compressed source (see resolvePoster's own comment) —
			// it must NOT get the long-lived immutable treatment, since the
			// re-encoded WebP lands in storage moments later via `after()`.
			// `no-store` means the very next request re-resolves and finds it
			// cached.
			"Cache-Control": resolved.fresh
				? "no-store"
				: "public, max-age=31536000, immutable",
		},
	});
}
