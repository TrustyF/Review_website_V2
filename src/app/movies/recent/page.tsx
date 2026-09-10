import { RecentMediaListPage } from "@/components/media/media-pages/recent-media-list-page/recent-media-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function RecentMoviesPage() {
	const dict = await getDictionary();
	return (
		<RecentMediaListPage
			title={`${dict.nav.movies} — ${dict.media.recentSuffix}`}
			type={MediaType.MOVIE}
			include={{ movie: true }}
			backHref="/movies"
		/>
	);
}
