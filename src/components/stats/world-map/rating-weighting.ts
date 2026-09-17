import type { CountryStat } from "@/components/stats/stats-types";

// A single- or double-digit-sample country's "average" is mostly noise —
// excluded from any rating-based ranking, though it still shows on hover.
export const MIN_SAMPLE_FOR_RATING = 1;

// Bayesian shrinkage applied to the rating value itself — blends toward the
// global mean by this many "phantom" ratings, so a 1-2 title country can't
// hit an extreme the way a well-sampled one can.
export const RATING_SHRINKAGE_PRIOR = 5;

// Count-weighted mean across every rated country — the shrinkage target for
// a country whose own sample is too small to fully trust.
export function globalRatingMean(data: CountryStat[]): number {
	const rated = data.filter((d) => d.avgRating != null);
	const totalCount = rated.reduce((sum, d) => sum + d.count, 0);
	if (totalCount === 0) return 0;
	const weightedSum = rated.reduce((sum, d) => sum + d.avgRating! * d.count, 0);
	return weightedSum / totalCount;
}

// Blends a country's own average with the global mean, weighted by sample
// size — more ratings means more trust in the country's own number.
function shrunkRating(
	avg: number,
	count: number,
	mean: number,
	prior: number,
): number {
	return (count * avg + prior * mean) / (count + prior);
}

// The one place a country's rating is actually read from, shared by the map
// (color) and the top-countries list (ranking + label) — null when there's
// no rating, or too few samples to trust one.
export function weightedCountryRating(
	stat: CountryStat,
	mean: number,
): number | null {
	if (stat.avgRating == null || stat.count < MIN_SAMPLE_FOR_RATING) return null;
	return shrunkRating(stat.avgRating, stat.count, mean, RATING_SHRINKAGE_PRIOR);
}
