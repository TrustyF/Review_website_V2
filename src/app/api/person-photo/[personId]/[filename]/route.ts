import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { resolvePersonPhoto } from "@/server/resolvers/poster-resolver";

// Same lazy resolve-or-download shape as /api/poster. [filename] is unused, only content-addressing the URL so the immutable Cache-Control below is safe.
export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ personId: string }> },
) {
	const { personId } = await params;
	const id = Number(personId);
	if (!Number.isFinite(id)) {
		return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
	}

	const person = await db.person.findUnique({
		where: { id },
		select: { photoPath: true },
	});
	if (!person?.photoPath) {
		return NextResponse.json({ error: "Photo not found" }, { status: 404 });
	}

	const resolved = await resolvePersonPhoto(id, person.photoPath);

	// Same TS 5.9 + @types/node v20 BodyInit cast friction as /api/poster.
	return new NextResponse(resolved.bytes as BodyInit, {
		headers: {
			"Content-Type": resolved.contentType,
			// `fresh` means raw, not-yet-re-encoded source, so it must not be cached as immutable.
			"Cache-Control": resolved.fresh
				? "no-store"
				: "public, max-age=31536000, immutable",
		},
	});
}
