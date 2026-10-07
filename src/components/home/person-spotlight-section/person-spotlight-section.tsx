import { loadWeeklyPersonSpotlight } from "./person-spotlight-query";
import { PersonSpotlightRow } from "./person-spotlight-row";

// Starts on the week's pick; PersonSpotlightRow re-rolls client-side.
export async function PersonSpotlightSection() {
	const initial = await loadWeeklyPersonSpotlight();
	if (!initial) return null;
	return <PersonSpotlightRow initial={initial} />;
}
