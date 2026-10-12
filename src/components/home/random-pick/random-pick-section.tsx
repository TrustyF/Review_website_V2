import { loadRandomPicks } from "./random-pick-query";
import { RandomPickCard } from "./random-pick-card";

type Props = {
	// Media already shown in sections above, never picked here.
	excludeIds: Promise<number[]>;
};

// Fresh picks on every request; RandomPickCard re-rolls client-side via fetchRandomPicks.
export async function RandomPickSection({ excludeIds }: Props) {
	const sectionIds = await excludeIds;
	const initial = await loadRandomPicks(sectionIds);
	if (initial.length === 0) return null;
	return <RandomPickCard initial={initial} excludeIds={sectionIds} />;
}
