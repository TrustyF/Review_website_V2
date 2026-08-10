import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic check only (cookie presence, no DB round-trip) — the actual
// authorization for mutations still happens in the server actions
// themselves (see require-admin.ts, watchlist-actions.ts). This just keeps
// a signed-out visitor from landing on a blank/broken /watchlist or
// /account page.
export default auth((req) => {
	if (!req.auth) {
		const loginUrl = new URL("/login", req.nextUrl);
		loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}
	return undefined;
});

export const config = {
	matcher: ["/watchlist/:path*", "/account/:path*"],
};
