import { SearchResultsPage } from "@/components/search/search-results-page/search-results-page";

type Props = {
	searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
	const { q } = await searchParams;
	return <SearchResultsPage query={q ?? ""} />;
}
