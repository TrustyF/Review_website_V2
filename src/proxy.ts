import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic only — req.auth is decoded straight off the JWT session cookie
// (no DB hit, see auth.ts's session: { strategy: "jwt" }), so this is just a
// fast, centralized "obviously not an admin" bounce before a page even
// starts rendering, not the real enforcement. That still lives where it has
// to regardless of what runs here: requireAdmin() in every admin-only
// Server Action (see require-admin.ts) — a Server Function is a POST to
// whatever route renders it, so a matcher mistake below would silently stop
// protecting a page without ever touching that layer.
export default auth((req) => {
	if (req.auth?.user?.role === "ADMIN") return;
	return NextResponse.redirect(new URL("/", req.url));
});

export const config = {
	matcher: ["/add", "/lists/new", "/lists/:id/edit", "/dev/image-crop"],
};
