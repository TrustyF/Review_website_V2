import type { Metadata } from "next";
import { RecentMediaListPage } from "@/components/media/media-pages/recent-media-list-page/recent-media-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";

function recentTitle(dict: Dictionary) {
	return `${dict.nav.movies} — ${dict.media.recentSuffix}`;
}

export async function generateMetadata(): Promise<Metadata> {
	return { title: recentTitle(await getDictionary()) };
}

export default async function RecentMoviesPage() {
	const dict = await getDictionary();
	return (
		<RecentMediaListPage
			title={recentTitle(dict)}
			type={MediaType.MOVIE}
			include={{ movie: true }}
			backHref="/movies"
		/>
	);
}
