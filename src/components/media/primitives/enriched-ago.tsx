"use client";

import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";

const DAY_MS = 24 * 60 * 60 * 1000;

// "3 days ago" rather than a full date/relative-time library — a rough staleness signal, not a precise timestamp.
function formatDaysAgo(date: Date): string {
	const days = Math.floor((Date.now() - date.getTime()) / DAY_MS);
	if (days <= 0) return "today";
	if (days === 1) return "1 day ago";
	return `${days} days ago`;
}

// Admin-only. Same client-side useIsAdmin gate as MediaEditButton, since this sits inside a server-rendered page rather than behind its own route.
export function EnrichedAgo({
	lastEnrichedAt,
	className,
}: {
	lastEnrichedAt: Date | null;
	className?: string | undefined;
}) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (same rule as nav-admin-links.tsx).
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	if (!isAdmin) return null;

	return (
		<span className={className}>
			{lastEnrichedAt
				? `Enriched ${formatDaysAgo(lastEnrichedAt)}`
				: "Never enriched"}
		</span>
	);
}
