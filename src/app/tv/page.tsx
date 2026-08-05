import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function TvPage() {
	return (
		<MediaTypeListPage
			title="TV"
			type={MediaType.TVSHOW}
			include={{ tvShow: true }}
		/>
	);
}
