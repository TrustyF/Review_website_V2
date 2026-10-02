import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { MyListsPage } from "@/components/lists/my-lists-page/my-lists-page";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.account.recommendations };
}

export default function AccountLists() {
	return <MyListsPage />;
}
