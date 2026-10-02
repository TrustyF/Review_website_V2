import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { WatchlistPage } from "@/components/watchlist/watchlist-page/watchlist-page";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.watchlist.title };
}

export default function Watchlist() {
	return <WatchlistPage />;
}
