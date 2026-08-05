import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function MoviesPage() {
	return (
		<MediaTypeListPage
			title="Movies"
			type={MediaType.MOVIE}
			include={{ movie: true }}
		/>
	);
}
