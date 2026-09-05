import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic only (JWT decoded); real enforcement in requireAdmin()
// per admin Server Action.
export default auth((req) => {
	if (req.auth?.user?.role === "ADMIN") return;
	return NextResponse.redirect(new URL("/", req.url));
});

export const config = {
	matcher: ["/add", "/lists/new", "/lists/:id/edit", "/dev/image-crop"],
};
