import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function BooksPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.books}
			type={MediaType.BOOK}
			include={{ book: true }}
		/>
	);
}
