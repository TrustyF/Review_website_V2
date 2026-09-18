import type { Metadata } from "next";
import { AllReviewsListPage } from "@/components/media/media-pages/all-reviews-list-page/all-reviews-list-page";

export const metadata: Metadata = {
	title: "All Reviews",
	description:
		"Every movie, TV show, book, comic, manga and game Arthur Sirjacobs has reviewed.",
	alternates: { canonical: "/reviews" },
};

export default function ReviewsPage() {
	return <AllReviewsListPage />;
}
