import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return {
		title: dict.nav.tv,
		description: "Arthur Sirjacobs' ratings and reviews of TV shows.",
		alternates: { canonical: "/tv" },
	};
}

export default async function TvPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.tv}
			type={MediaType.TVSHOW}
			include={{ tvShow: true }}
			switcher={[
				{ href: "/movies", label: dict.nav.movies },
				{ href: "/tv", label: dict.nav.tv },
				{ href: "/shorts", label: dict.nav.shorts },
			]}
		/>
	);
}
