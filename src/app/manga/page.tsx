import { MediaTypeListPage } from "@/components/media/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function MangaPage() {
	return (
		<MediaTypeListPage
			title="Manga"
			type={MediaType.MANGA}
			include={{ manga: true }}
		/>
	);
}
