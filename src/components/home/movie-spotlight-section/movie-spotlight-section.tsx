import { loadMovieSpotlight } from "./movie-spotlight-query";
import { MovieSpotlightRow } from "./movie-spotlight-row";

// Fresh random selection on every request; MovieSpotlightRow re-rolls client-side.
export async function MovieSpotlightSection() {
	const initial = await loadMovieSpotlight([]);
	if (initial.length === 0) return null;
	return <MovieSpotlightRow initial={initial} />;
}
