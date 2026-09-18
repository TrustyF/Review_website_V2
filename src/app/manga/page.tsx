import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = {
	title: "Manga Reviews",
	description: "Arthur Sirjacobs' ratings and reviews of manga.",
	alternates: { canonical: "/manga" },
};

export default async function MangaPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.manga}
			type={MediaType.MANGA}
			include={{ manga: true }}
			switcher={[
				{ href: "/manga", label: dict.nav.manga },
				{ href: "/comics", label: dict.nav.comics },
				{ href: "/books", label: dict.nav.books },
			]}
		/>
	);
}
