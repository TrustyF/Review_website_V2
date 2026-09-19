import { MediaType } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";
import { SITE_URL } from "@/lib/site-url";
import { personIdentity } from "@/lib/identity";

// schema.org type per MediaType — what Google's Review rich result needs
// `itemReviewed.@type` to be for each catalog section.
const SCHEMA_TYPE: Record<MediaType, string> = {
	MOVIE: "Movie",
	SHORT: "Movie",
	TVSHOW: "TVSeries",
	BOOK: "Book",
	COMIC: "ComicStory",
	MANGA: "ComicStory",
	GAME: "VideoGame",
};

// Builds the Review + itemReviewed JSON-LD for a media detail page. Returns
// null when there's no rating yet — an unrated entry has nothing to review.
export function buildMediaReviewJsonLd(
	media: MediaRecord,
	posterAbsoluteUrl: string | null,
) {
	const rating = media.review?.rating;
	if (rating == null) return null;

	const url = `${SITE_URL}/media/${media.id}`;

	return {
		"@context": "https://schema.org",
		"@type": "Review",
		itemReviewed: {
			"@type": SCHEMA_TYPE[media.type],
			name: media.title,
			url,
			...(posterAbsoluteUrl ? { image: posterAbsoluteUrl } : {}),
			...(media.genres.length ? { genre: media.genres } : {}),
			...(media.releaseDate
				? { datePublished: media.releaseDate.toISOString().slice(0, 10) }
				: {}),
		},
		reviewRating: {
			"@type": "Rating",
			ratingValue: rating,
			bestRating: 10,
			worstRating: 0,
		},
		author: { "@id": personIdentity["@id"] },
		...(media.review?.reviewDate
			? { datePublished: media.review.reviewDate.toISOString().slice(0, 10) }
			: {}),
		...(media.review?.body ? { reviewBody: media.review.body } : {}),
	};
}
