import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function ShortsPage() {
	return (
		<MediaTypeListPage
			title="Shorts"
			type={MediaType.SHORT}
			include={{ movie: true }}
		/>
	);
}
