"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import { fetchTmdbImages } from "@/server/tmdb/client";
import { resolvePoster } from "@/server/resolvers/poster-resolver";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";

// Compares old/new values field by field and returns a MediaChangeLog row
// for each one that actually changed — untouched fields produce no row.
function diffFields(
	mediaId: number,
	before: Record<string, unknown>,
	after: Record<string, unknown>,
) {
	const changes: {
		mediaId: number;
		field: string;
		oldValue: string | null;
		newValue: string | null;
	}[] = [];
	for (const field of Object.keys(after)) {
		const oldValue = before[field] ?? null;
		const newValue = after[field] ?? null;
		if (oldValue === newValue) continue;
		changes.push({
			mediaId,
			field,
			oldValue: oldValue == null ? null : String(oldValue),
			newValue: newValue == null ? null : String(newValue),
		});
	}
	return changes;
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
	const existing = await db.review.findUnique({ where: { mediaId } });

	await db.review.upsert({
		where: { mediaId },
		update: review,
		create: { mediaId, ...review },
	});

	const changes = diffFields(
		mediaId,
		existing ?? {},
		review,
	);
	if (changes.length) {
		await db.mediaChangeLog.createMany({ data: changes });
	}

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
	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { posterPath: true },
	});

	await db.media.update({ where: { id: mediaId }, data: { posterPath } });

	if (existing?.posterPath !== posterPath) {
		await db.mediaChangeLog.create({
			data: {
				mediaId,
				field: "posterPath",
				oldValue: existing?.posterPath ?? null,
				newValue: posterPath,
			},
		});
	}

	const posterSrc = await resolvePoster(mediaId, posterPath);
	revalidatePath("/");
	return posterSrc;
}
