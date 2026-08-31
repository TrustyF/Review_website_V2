"use server";
import { MediaRecord } from "@/components/media/types";
import { loadReviewsPage } from "./all-reviews-query";

// Client trusts the server's own hasMore rather than guessing from a returned-fewer-than-PAGE_SIZE heuristic, which a skip landing exactly on the last page's boundary would get wrong.
export async function loadMoreReviews(
	offset: number,
): Promise<{ media: MediaRecord[]; hasMore: boolean }> {
	return loadReviewsPage(offset);
}
