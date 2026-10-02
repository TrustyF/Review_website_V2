import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AllReviewsListPage } from "@/components/media/media-pages/all-reviews-list-page/all-reviews-list-page";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return {
		title: dict.nav.reviews,
		description:
			"Every movie, TV show, book, comic, manga and game Arthur Sirjacobs has reviewed.",
		alternates: { canonical: "/reviews" },
	};
}

export default function ReviewsPage() {
	return <AllReviewsListPage />;
}
