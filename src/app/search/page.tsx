import type { Metadata } from "next";
import { SearchResultsPage } from "@/components/search/search-results-page/search-results-page";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type Props = {
	searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
	searchParams,
}: Props): Promise<Metadata> {
	const [{ q }, dict] = await Promise.all([searchParams, getDictionary()]);
	const query = q?.trim();
	return {
		title: query
			? dict.pageTitles.searchResults(query)
			: dict.pageTitles.search,
		// Query-driven results page — noindex avoids Google indexing endless thin
		// ?q= variants, but keep it followable so links inside results still get crawled.
		robots: { index: false, follow: true },
	};
}

export default async function SearchPage({ searchParams }: Props) {
	const { q } = await searchParams;
	return <SearchResultsPage query={q ?? ""} />;
}
