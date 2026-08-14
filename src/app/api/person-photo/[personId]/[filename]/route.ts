import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { resolvePersonPhoto } from "@/server/resolvers/poster-resolver";

// Same lazy resolve-or-download-on-request shape as /api/poster — see that
// route's own comment. [filename] itself isn't read here either, only
// existing so the URL is content-addressed by photoPath (see
// toPersonPhotoSrc), which is what makes the long-lived immutable
// Cache-Control below safe.
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

	const { bytes, contentType } = await resolvePersonPhoto(
		id,
		person.photoPath,
	);

	// Same TS 5.9 + @types/node v20 BodyInit friction as /api/poster's own
	// cast — see that route's comment.
	return new NextResponse(bytes as BodyInit, {
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
