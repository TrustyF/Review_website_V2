"use server";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import { fetchTmdbImages } from "@/server/tmdb/client";
import { resolvePoster } from "@/server/resolvers/poster-resolver";
import { buildProxiedImageUrl } from "@/server/image-proxy";

export async function getMediaForEdit(mediaId: number) {
	const raw = await db.media.findFirstOrThrow({
		where: { id: mediaId },
		include: {
			movie: true,
			tvShow: true,
			review: true,
		},
	});
	return toMediaRecord(raw);
}

export async function saveReview(
	mediaId: number,
	review: {
		rating: number | null;
		liked: boolean;
		difficulty: number;
		body: string | null;
	},
) {
	await db.review.upsert({
		where: { mediaId },
		update: review,
		create: { mediaId, ...review },
	});
	revalidatePath("/");
}

// Movie/Short/TvShow only — those are the types actually sourced from TMDB
// and so the only ones with alternative posters to pick from.
export async function getAlternativePosters(
	externalId: string,
	type: MediaType,
) {
	const images = await fetchTmdbImages(externalId, type);
	return images.posters
		.slice()
		.sort((a, b) => b.vote_average - a.vote_average)
		.slice(0, 20)
		.map((poster) => ({
			filePath: poster.file_path,
			width: poster.width,
			height: poster.height,
			// Proxied rather than hotlinked directly, so trying a poster never
			// depends on whether the source allows hotlinking (see
			// src/server/image-proxy.ts) — no download happens until it's saved.
			thumbSrc: buildProxiedImageUrl(
				`https://image.tmdb.org/t/p/w154${poster.file_path}`,
			),
			previewSrc: buildProxiedImageUrl(
				`https://image.tmdb.org/t/p/w500${poster.file_path}`,
			),
		}));
}

export async function updateMediaPoster(mediaId: number, posterPath: string) {
	await db.media.update({ where: { id: mediaId }, data: { posterPath } });
	const posterSrc = await resolvePoster(mediaId, posterPath);
	revalidatePath("/");
	return posterSrc;
}
