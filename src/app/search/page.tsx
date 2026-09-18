import type { Metadata } from "next";
import { SearchResultsPage } from "@/components/search/search-results-page/search-results-page";

// Query-driven results page — noindex avoids Google indexing endless thin
// ?q= variants, but keep it followable so links inside results still get crawled.
export const metadata: Metadata = {
	robots: { index: false, follow: true },
};

type Props = {
	searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
	const { q } = await searchParams;
	return <SearchResultsPage query={q ?? ""} />;
}
