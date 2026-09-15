"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { start, stop } from "@/lib/analytics/rrweb-session";

// Session recording, mounted once in layout.tsx. Skipped in dev and for
// admins (admin screens surface other users' PII).
export function RrwebAnalytics() {
	const { data: session, status } = useSession();
	const isAdmin = session?.user?.role === "ADMIN";

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (status === "loading") return;
		if (isAdmin) return;

		start();
		return () => stop();
	}, [status, isAdmin]);

	return null;
}
