import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function ComicsPage() {
	return (
		<MediaTypeListPage
			title="Comics"
			type={MediaType.COMIC}
			include={{ comic: true }}
		/>
	);
}
