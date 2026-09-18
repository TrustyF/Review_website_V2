import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = {
	title: "Short Film Reviews",
	description: "Arthur Sirjacobs' ratings and reviews of short films.",
	alternates: { canonical: "/shorts" },
};

export default async function ShortsPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.shorts}
			type={MediaType.SHORT}
			include={{ movie: true }}
			switcher={[
				{ href: "/movies", label: dict.nav.movies },
				{ href: "/tv", label: dict.nav.tv },
				{ href: "/shorts", label: dict.nav.shorts },
			]}
		/>
	);
}
