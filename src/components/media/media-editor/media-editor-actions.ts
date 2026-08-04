"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTmdbImages } from "@/server/tmdb/client";
import { fetchMangaDexCovers } from "@/server/mangadex/client";
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

	const changes = diffFields(mediaId, existing ?? {}, review);
	if (changes.length) {
		await db.mediaChangeLog.createMany({ data: changes });
	}

	revalidatePath("/");
}

// Read-only — returns a suggested rewrite, never touches the draft or DB.
// The caller decides what (if anything) to copy into the actual body field.
export async function suggestReviewCorrection(body: string): Promise<string> {
	if (!body.trim()) return "";

	const client = new Anthropic();
	const response = await client.messages.create({
		model: "claude-opus-5",
		max_tokens: 2048,
		output_config: { effort: "low" },
		system:
			"You proofread review text for a personal movie/TV/manga/game log. Fix grammar, spelling, clarity issues and repetitive wording. It should read like an essay. Preserve the reviewer's opinions. Reply with only the corrected text: no preamble, no explanation, no surrounding quotes.",
		messages: [{ role: "user", content: body }],
	});

	const textBlock = response.content.find((block) => block.type === "text");
	return textBlock?.type === "text" ? textBlock.text : "";
}

// IGDB (games) exposes exactly one cover per game with no alternates to
// browse, so GAME isn't handled here — see POSTER_PICKER_TYPES in
// media-editor-modal.tsx, which keeps the picker from ever mounting for it.
export async function getAlternativePosters(
	externalId: string,
	type: MediaType,
) {
	if (type === MediaType.MANGA) {
		const covers = await fetchMangaDexCovers(externalId);
		return covers.map((cover) => ({
			filePath: cover.attributes.fileName,
			// Proxied rather than hotlinked directly, so trying a poster never
			// depends on whether the source allows hotlinking (see
			// src/server/image-proxy.ts) — no download happens until it's saved.
			thumbSrc: buildProxiedImageUrl(
				`https://uploads.mangadex.org/covers/${externalId}/${cover.attributes.fileName}.256.jpg`,
			),
			previewSrc: buildProxiedImageUrl(
				`https://uploads.mangadex.org/covers/${externalId}/${cover.attributes.fileName}.512.jpg`,
			),
		}));
	}

	const images = await fetchTmdbImages(externalId, type);
	return images.posters
		.slice()
		.sort((a, b) => b.vote_average - a.vote_average)
		.map((poster) => ({
			filePath: poster.file_path,
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
		select: { posterPath: true, type: true, externalId: true },
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

	const posterSrc = await resolvePoster(
		mediaId,
		existing!.type,
		existing!.externalId,
		posterPath,
	);
	revalidatePath("/");
	return posterSrc;
}
