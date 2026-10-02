import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ListsOverviewPage } from "@/components/lists/lists-overview-page/lists-overview-page";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.nav.lists };
}

export default function ListsPage() {
	return <ListsOverviewPage />;
}
