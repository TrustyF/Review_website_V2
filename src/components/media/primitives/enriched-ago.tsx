"use client";

import { useIsAdmin } from "@/lib/use-is-admin";

const DAY_MS = 24 * 60 * 60 * 1000;

// "3 days ago" rather than a full date/relative-time library — the only
// thing anyone actually wants from this at a glance is roughly how stale
// this row's enrichment is, not a precise timestamp.
function formatDaysAgo(date: Date): string {
	const days = Math.floor((Date.now() - date.getTime()) / DAY_MS);
	if (days <= 0) return "today";
	if (days === 1) return "1 day ago";
	return `${days} days ago`;
}

// Admin-only — everyone else has no reason to care how fresh a row's
// TMDB/MangaDex/IGDB/ComicVine/Google Books data is. Same client-side
// useIsAdmin gate as MediaEditButton, since this sits inside the server-
// rendered media detail page rather than behind its own route.
export function EnrichedAgo({
	lastEnrichedAt,
	className,
}: {
	lastEnrichedAt: Date | null;
	className?: string | undefined;
}) {
	const isAdmin = useIsAdmin();
	if (!isAdmin) return null;

	return (
		<span className={className}>
			{lastEnrichedAt
				? `Enriched ${formatDaysAgo(lastEnrichedAt)}`
				: "Never enriched"}
		</span>
	);
}
