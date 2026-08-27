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

	// Split by upstream host too, not just the route — makes it obvious in
	// the /dev/invocations breakdown whether a spike came from TMDB, IGDB, etc.
	recordInvocation("GET /api/image-proxy");
	recordInvocation(`GET /api/image-proxy (${url.hostname})`);

	const upstream = await fetch(url, { headers: { Accept: "image/*" } });
	if (!upstream.ok || !upstream.body) {
		return NextResponse.json(
			{ error: "Upstream image fetch failed" },
			{ status: 502 },
		);
	}

	return new NextResponse(upstream.body, {
		headers: {
			"Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
			// s-maxage lets Vercel's edge CDN serve repeat requests for the same
			// token (poster picker re-opened, another visitor, browser cache
			// evicted) without re-invoking this function at all — max-age alone
			// only covers the requesting browser's own cache. Tokens are
			// content-addressed (same remote URL -> same token), so a long TTL
			// is safe.
			"Cache-Control":
				"public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
		},
	});
}
