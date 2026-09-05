import { NextResponse } from "next/server";
import { resolveProxiedImageUrl } from "@/server/resolvers/image-proxy";
import { recordInvocation } from "@/server/dev/invocation-tracker";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ token: string }> },
) {
	const { token } = await params;

	let url: URL;
	try {
		url = resolveProxiedImageUrl(token);
	} catch {
		return NextResponse.json({ error: "Invalid image token" }, { status: 400 });
	}

	// Split by upstream host too, so /dev/invocations shows which provider a spike came from.
	recordInvocation("GET /api/image-proxy");
	recordInvocation(`GET /api/image-proxy (${url.hostname})`);

	let upstream: Response;
	try {
		upstream = await fetch(url, {
			headers: { Accept: "image/*" },
			// Without timeout, slow upstream leaves request open indefinitely,
			// keeping browser spinner going even after page renders.
			signal: AbortSignal.timeout(10_000),
		});
	} catch {
		return NextResponse.json(
			{ error: "Upstream image fetch timed out" },
			{ status: 504 },
		);
	}
	if (!upstream.ok || !upstream.body) {
		return NextResponse.json(
			{ error: "Upstream image fetch failed" },
			{ status: 502 },
		);
	}

	return new NextResponse(upstream.body, {
		headers: {
			"Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
			// s-maxage lets the edge CDN serve repeat requests without re-invoking this function; safe since tokens are content-addressed.
			"Cache-Control":
				"public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
		},
	});
}
