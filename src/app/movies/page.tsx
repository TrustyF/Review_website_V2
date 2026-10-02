import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return {
		title: dict.nav.movies,
		description: "Arthur Sirjacobs' ratings and reviews of movies.",
		alternates: { canonical: "/movies" },
	};
}

export default async function MoviesPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.movies}
			type={MediaType.MOVIE}
			include={{ movie: true }}
			recentHref="/movies/recent"
			switcher={[
				{ href: "/movies", label: dict.nav.movies },
				{ href: "/tv", label: dict.nav.tv },
				{ href: "/shorts", label: dict.nav.shorts },
			]}
		/>
	);
}
