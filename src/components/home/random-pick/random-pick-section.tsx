import { loadRandomPicks } from "./random-pick-query";
import { RandomPickCard } from "./random-pick-card";

// Fresh picks on every request; RandomPickCard re-rolls client-side via fetchRandomPicks.
export async function RandomPickSection() {
	const initial = await loadRandomPicks([]);
	if (initial.length === 0) return null;
	return <RandomPickCard initial={initial} />;
}
