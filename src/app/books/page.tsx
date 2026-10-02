import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return {
		title: dict.nav.books,
		description: "Arthur Sirjacobs' ratings and reviews of books.",
		alternates: { canonical: "/books" },
	};
}

export default async function BooksPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.books}
			type={MediaType.BOOK}
			include={{ book: true }}
			switcher={[
				{ href: "/manga", label: dict.nav.manga },
				{ href: "/comics", label: dict.nav.comics },
				{ href: "/books", label: dict.nav.books },
			]}
		/>
	);
}
