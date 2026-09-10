import { searchAllMedia } from "@/components/search/search-actions";
import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchPageInput } from "@/components/search/search-page-input";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./search-results-page.module.sass";

// Full page beats the old navbar dropdown once matches grow — 8 was the most
// the dropdown could show without eating half the viewport.
const RESULTS_LIMIT = 60;

// Capped at display time (not by lowering RESULTS_LIMIT) so one section's cap
// is independent of how much the other fills, in either direction.
const MEDIA_DISPLAY_LIMIT = 14;
// People/companies are secondary here (titles are what most visitors want), so
// this stays capped rather than growing to match however many of the 60 are entities.
const ENTITY_DISPLAY_LIMIT = 16;

// Backs /search — the navbar's search icon navigates here instead of a live popout.
export async function SearchResultsPage({ query }: { query: string }) {
	const trimmed = query.trim();
	const results = trimmed ? await searchAllMedia(trimmed, RESULTS_LIMIT) : [];
	const mediaResults = results
		.filter((result) => result.kind === "media")
		.slice(0, MEDIA_DISPLAY_LIMIT);
	const entityResults = results
		.filter((result) => result.kind !== "media")
		.slice(0, ENTITY_DISPLAY_LIMIT);
	const dict = await getDictionary();

	return (
		<div className={styles.wrapper}>
			<SearchPageInput initialQuery={query} />

			{trimmed === "" ? (
				<p className={styles.empty}>{dict.searchPage.promptEmpty}</p>
			) : results.length === 0 ? (
				<p className={styles.empty}>{dict.searchPage.noMatches(trimmed)}</p>
			) : (
				<>
					{mediaResults.length > 0 && (
						<section className={styles.section}>
							<h2 className={styles.section_title}>{dict.searchPage.titlesSection}</h2>
							<div className={styles.media_grid}>
								{mediaResults.map((result) => (
									<SearchResultCard key={`media-${result.id}`} result={result} />
								))}
							</div>
						</section>
					)}
					{entityResults.length > 0 && (
						<section className={styles.section}>
							<h2 className={styles.section_title}>
								{dict.searchPage.peopleCompaniesSection}
							</h2>
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
