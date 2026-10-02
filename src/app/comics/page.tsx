import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return {
		title: dict.nav.comics,
		description: "Arthur Sirjacobs' ratings and reviews of comics.",
		alternates: { canonical: "/comics" },
	};
}

export default async function ComicsPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.comics}
			type={MediaType.COMIC}
			include={{ comic: true }}
			switcher={[
				{ href: "/manga", label: dict.nav.manga },
				{ href: "/comics", label: dict.nav.comics },
				{ href: "/books", label: dict.nav.books },
			]}
		/>
	);
}
