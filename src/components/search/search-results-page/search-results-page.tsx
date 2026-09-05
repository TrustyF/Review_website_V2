import { searchAllMedia } from "@/components/search/search-actions";
import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchPageInput } from "@/components/search/search-page-input";
import styles from "./search-results-page.module.sass";

// Full page beats the old navbar dropdown once the number of relevant
// matches grows — 8 was the largest the dropdown could show without eating
// half the viewport, this page has room for many more.
const RESULTS_LIMIT = 60;

// Both sections are capped at display time (rather than lowering
// RESULTS_LIMIT) so a query with many strong title matches doesn't get
// starved by a query that also happens to surface a lot of entities, or
// vice versa — each section's own cap is independent of how the other fills.
const MEDIA_DISPLAY_LIMIT = 14;
// People/companies are a secondary result kind here (titles are what most
// visitors are after), so even after searchAllMedia's own confidence
// threshold trims weak name matches, the section is capped rather than
// letting it grow to match however many of the 60 fetched results happen to
// be entities.
const ENTITY_DISPLAY_LIMIT = 16;

// Backs /search — the navbar's search icon now navigates here instead of
// showing a live popout (see nav-search.tsx).
export async function SearchResultsPage({ query }: { query: string }) {
	const trimmed = query.trim();
	const results = trimmed ? await searchAllMedia(trimmed, RESULTS_LIMIT) : [];
	const mediaResults = results
		.filter((result) => result.kind === "media")
		.slice(0, MEDIA_DISPLAY_LIMIT);
	const entityResults = results
		.filter((result) => result.kind !== "media")
		.slice(0, ENTITY_DISPLAY_LIMIT);

	return (
		<div className={styles.wrapper}>
			<SearchPageInput initialQuery={query} />

			{trimmed === "" ? (
				<p className={styles.empty}>Search for a title, person, or company.</p>
			) : results.length === 0 ? (
				<p className={styles.empty}>No matches for “{trimmed}”.</p>
			) : (
				<>
					{mediaResults.length > 0 && (
						<section className={styles.section}>
							<h2 className={styles.section_title}>Titles</h2>
							<div className={styles.media_grid}>
								{mediaResults.map((result) => (
									<SearchResultCard key={`media-${result.id}`} result={result} />
								))}
							</div>
						</section>
					)}
					{entityResults.length > 0 && (
						<section className={styles.section}>
							<h2 className={styles.section_title}>People &amp; Companies</h2>
							<div className={styles.entity_list}>
								{entityResults.map((result) => (
									<SearchResultCard
										key={`${result.kind}-${result.id}`}
										result={result}
									/>
								))}
							</div>
						</section>
					)}
				</>
			)}
		</div>
	);
}
