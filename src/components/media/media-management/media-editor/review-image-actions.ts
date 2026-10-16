"use server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
	persistReviewImage,
	type ReviewImageResult,
} from "@/server/resolvers/review-image-resolver";

// Called by the review body editor's Image button; see ReviewImageResult for the heavy-image round trip.
export async function resolveReviewImageUrl(
	mediaId: number,
	url: string,
	allowHeavy = false,
): Promise<ReviewImageResult> {
	await requireAdmin();
	return persistReviewImage(mediaId, url, allowHeavy);
}
