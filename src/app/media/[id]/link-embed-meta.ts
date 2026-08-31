// Shared by generateMediaMetadata and the dev preview tool so both build the
// exact same og:description text.
export function buildLinkEmbedDescription(media: {
	overview: string | null;
	publicRating: number | null;
	review: { rating: number | null } | null;
}): string | undefined {
	const rating = media.review?.rating ?? media.publicRating;
	return (
		[rating != null ? `★ ${rating.toFixed(1)}` : null, media.overview]
			.filter(Boolean)
			.join(" — ") || undefined
	);
}
