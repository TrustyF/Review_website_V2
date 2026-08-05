"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTmdbImages } from "@/server/tmdb/client";
import { fetchMangaDexCovers } from "@/server/mangadex/client";
import { fetchComicVineIssuesForVolume } from "@/server/comicvine/client";
import { fetchIgdbGameCoverOptions } from "@/server/igdb/client";
import { posterUrlFor, resolvePoster } from "@/server/resolvers/poster-resolver";
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

	// Only log once a review already exists — the first save just creates it,
	// and a wall of "— → 8" entries for fields that never had a prior value
	// isn't a change worth recording. Body is excluded from the diff
	// entirely — review text gets edited/proofread often enough that
	// logging every pass would drown out the fields worth tracking.
	if (existing) {
		const changes = diffFields(mediaId, existing, {
			rating: review.rating,
			liked: review.liked,
			difficulty: review.difficulty,
		});
		if (changes.length) {
			await db.mediaChangeLog.createMany({ data: changes });
		}
	}

	revalidatePath("/");
}

// Base Media fields (title/overview/releaseDate) are otherwise only ever
// set by a source's ingest — this is the one path that lets them be
// hand-edited, for media a provider doesn't have data for (or has wrong
// data for) at all.
export async function saveMediaDetails(
	mediaId: number,
	details: {
		title: string;
		overview: string | null;
		releaseDate: string | null;
	},
) {
	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { title: true, overview: true, releaseDate: true },
	});

	const releaseDate = details.releaseDate
		? new Date(details.releaseDate)
		: null;

	await db.media.update({
		where: { id: mediaId },
		data: { title: details.title, overview: details.overview, releaseDate },
	});

	const changes = diffFields(
		mediaId,
		{
			title: existing?.title,
			overview: existing?.overview,
			releaseDate: existing?.releaseDate?.toISOString().slice(0, 10) ?? null,
		},
		{
			title: details.title,
			overview: details.overview,
			releaseDate: releaseDate?.toISOString().slice(0, 10) ?? null,
		},
	);
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
				posterUrlFor(type, externalId, cover.attributes.fileName, "thumb"),
			),
			previewSrc: buildProxiedImageUrl(
				posterUrlFor(type, externalId, cover.attributes.fileName, "full"),
			),
		}));
	}

	if (type === MediaType.COMIC) {
		// ComicVine has no alternate-cover concept at the volume level (unlike
		// TMDB/MangaDex) — each issue's own cover stands in for one instead.
		// filePath is a full URL rather than a path fragment, matching how
		// poster-resolver.ts stores/reads COMIC posterPaths.
		const issues = await fetchComicVineIssuesForVolume(externalId);
		return issues
			.filter((issue) => issue.image?.medium_url)
			.map((issue) => {
				const medium = issue.image!.medium_url!;
				return {
					filePath: medium,
					thumbSrc: buildProxiedImageUrl(issue.image!.small_url ?? medium),
					previewSrc: buildProxiedImageUrl(medium),
				};
			});
	}

	if (type === MediaType.GAME) {
		// A game's own game object only ever has one cover — IGDB.com's
		// "alternate covers" gallery is actually region-specific box art
		// (game_localizations), fetched and combined with the default cover
		// in fetchIgdbGameCoverOptions. filePath is a bare image_id, matching
		// how poster-resolver.ts stores/reads GAME posterPaths.
		const covers = await fetchIgdbGameCoverOptions(externalId);
		return covers.map((cover) => ({
			filePath: cover.imageId,
			thumbSrc: buildProxiedImageUrl(
				posterUrlFor(type, externalId, cover.imageId, "thumb"),
			),
			previewSrc: buildProxiedImageUrl(
				posterUrlFor(type, externalId, cover.imageId, "full"),
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
				posterUrlFor(type, externalId, poster.file_path, "thumb"),
			),
			previewSrc: buildProxiedImageUrl(
				posterUrlFor(type, externalId, poster.file_path, "full"),
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
