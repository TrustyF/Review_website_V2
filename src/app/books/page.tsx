import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";

export default function BooksPage() {
	return (
		<MediaTypeListPage
			title="Books"
			type={MediaType.BOOK}
			include={{ book: true }}
		/>
	);
}
