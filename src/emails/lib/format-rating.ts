// Same trailing-.0 drop as circular-gauge.tsx's byte-count formatter.
export function formatRating(rating: number): string {
	return rating.toFixed(1).replace(/\.0$/, "");
}
