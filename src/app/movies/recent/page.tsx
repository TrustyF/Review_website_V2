import { RecentMediaListPage } from "@/components/media/media-pages/recent-media-list-page/recent-media-list-page";
import { MediaType } from "@prisma/client";

export default function RecentMoviesPage() {
	return (
		<RecentMediaListPage
			title="Movies — recent"
			type={MediaType.MOVIE}
			include={{ movie: true }}
			backHref="/movies"
		/>
	);
}
