import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function GamesPage() {
	return (
		<MediaTypeListPage
			title="Games"
			type={MediaType.GAME}
			include={{ game: true }}
		/>
	);
}
