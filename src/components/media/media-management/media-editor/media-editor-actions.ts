"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { MediaType } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTmdbImages } from "@/server/tmdb/client";
import { fetchMangaDexCovers } from "@/server/mangadex/client";
import { fetchComicVineIssuesForVolume } from "@/server/comicvine/client";
import {
	artworkAspectRatioDiff,
	fetchIgdbGameById,
	fetchIgdbGameCoverOptions,
} from "@/server/igdb/client";
import {
	bannerUrlFor,
	posterUrlFor,
	resolveBanner,
	resolvePoster,
} from "@/server/resolvers/poster-resolver";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";

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

	// Each set once, the first time its own trigger actually happens — keyed
	// off the dedicated date field itself (not re-derived from rating/body),
	// so an unrate-then-rerate or a body cleared-then-rewritten later doesn't
	// silently move "Watched on"/"Reviewed on" off their original dates.
	// Subsequent re-rates are what MediaChangeLog's "rewatched" milestone
	// (logRewatch) is for instead.
	const hasRating = review.rating != null;
	const hasBody = Boolean(review.body?.trim());
	// Spread in conditionally rather than passing `undefined` for the "not
	// yet" case — exactOptionalPropertyTypes rejects an explicit `undefined`
	// value for these (Prisma's input type wants the key entirely absent, a
	// real Date, or null, never `undefined`).
	const dateFields = {
		...(!existing?.ratedDate && hasRating ? { ratedDate: new Date() } : {}),
		...(!existing?.reviewedDate && hasBody ? { reviewedDate: new Date() } : {}),
	};

	await db.review.upsert({
		where: { mediaId },
		update: { ...review, ...dateFields },
		create: { mediaId, ...review, ...dateFields },
	});

	const changes: {
		mediaId: number;
		field: string;
		oldValue: string | null;
		newValue: string | null;
	}[] = [];

	// Only log the usual field-by-field diff once a review already exists —
	// the very first save just creates it, and a wall of "— → 8" entries for
	// fields that never had a prior value isn't a change worth recording.
	if (existing) {
		changes.push(
			...diffFields(mediaId, existing, {
				rating: review.rating,
				liked: review.liked,
				difficulty: review.difficulty,
			}),
		);
	}

	// Body itself stays out of the diff above — edited/proofread often enough
	// that logging every pass would drown out the fields worth tracking —
	// but writing a first review is a real milestone worth marking on its
	// own, whether that happens on this same save (existing === null) or a
	// later one that fills in a body that was empty before.
	const hadBody = Boolean(existing?.body?.trim());
	if (!hadBody && hasBody) {
		changes.push({
			mediaId,
			field: "reviewed",
			oldValue: null,
			newValue: "true",
		});
	}

	if (changes.length) {
		await db.mediaChangeLog.createMany({ data: changes });
	}

	revalidatePath("/");
}

// A rewatch has no field of its own to diff — it's not "rating changed",
// it's "watched it again" — so unlike everything else in this file it's
// logged directly on request rather than inferred from a before/after
// comparison. Repeatable (unlike "reviewed"): every call adds another
// "Rewatched on" row, one per actual rewatch.
export async function logRewatch(mediaId: number) {
	await db.mediaChangeLog.create({
		data: { mediaId, field: "rewatched", oldValue: null, newValue: "true" },
	});
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

// Soft delete just flips Media.isDeleted — every public list query filters
// it out (see src/app/page.tsx, media-type-list-page.tsx,
// credit-media-list-page.tsx), but the row (and its files, review, credits,
// change log) stays put, and /media/[id] stays directly reachable so this
// same toggle can restore it later. Note the @@unique([externalId, type])
// constraint still holds while soft-deleted — re-adding the same title from
// search will collide with it; restoring here is the way back, not search.
export async function setMediaDeleted(mediaId: number, isDeleted: boolean) {
	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { isDeleted: true },
	});
	if (existing?.isDeleted === isDeleted) return;

	await db.media.update({ where: { id: mediaId }, data: { isDeleted } });
	await db.mediaChangeLog.create({
		data: {
			mediaId,
			field: "isDeleted",
			oldValue: String(existing?.isDeleted ?? false),
			newValue: String(isDeleted),
		},
	});

	revalidatePath("/");
	revalidatePath(`/media/${mediaId}`);
}

// Irreversible: the row itself is gone, and with it every relation that
// cascades from Media (Movie/TvShow/Manga/Comic/Game, Review, Credit,
// MediaGenre, MediaChangeLog — see onDelete: Cascade in schema.prisma). No
// change log entry follows, since there'd be nothing left for it to point
// at. Cached poster/banner files on disk aren't touched here — they're
// swept up as orphans by the next cleanup-posters run.
export async function hardDeleteMedia(mediaId: number) {
	await db.media.delete({ where: { id: mediaId } });
	revalidatePath("/");
}

const MARKUP_PLACEHOLDER_REGEX = /⟦MARKUP(\d+)⟧/g;

// Swaps every ||spoiler|| / [text](url) span for an opaque placeholder so
// the model sent to suggestReviewCorrection never sees (and so can never
// mangle) the actual syntax — restoreMarkup puts the original spans back
// wherever those placeholders land in the response. Driven by the same
// regex the renderer uses, so new markup syntax is excluded automatically;
// nothing here needs to change for it. The one real cost: text inside a
// span doesn't get proofread, since the model never sees it either.
function extractMarkup(body: string): { stripped: string; spans: string[] } {
	const spans: string[] = [];
	const stripped = body.replace(REVIEW_MARKUP_REGEX, (match) => {
		const index = spans.push(match) - 1;
		return `⟦MARKUP${index}⟧`;
	});
	return { stripped, spans };
}

function restoreMarkup(text: string, spans: string[]): string {
	return text.replace(MARKUP_PLACEHOLDER_REGEX, (full, indexStr: string) => {
		return spans[Number(indexStr)] ?? full;
	});
}

// Read-only — returns a suggested rewrite, never touches the draft or DB.
// The caller decides what (if anything) to copy into the actual body field.
export async function suggestReviewCorrection(body: string): Promise<string> {
	if (!body.trim()) return "";

	const { stripped, spans } = extractMarkup(body);

	const client = new Anthropic();
	const response = await client.messages.create({
		model: "claude-opus-5",
		max_tokens: 2048,
		output_config: { effort: "low" },
		system:
			"You proofread review text for a personal movie/TV/manga/game log. Fix grammar, spelling, clarity issues and repetitive wording. It should read like an essay. Preserve the reviewer's opinions. The text may contain placeholder tokens like ⟦MARKUP0⟧ — leave every one exactly as it is: don't add, remove, rename, translate, or explain them. Reply with only the corrected text: no preamble, no explanation, no surrounding quotes.",
		messages: [{ role: "user", content: stripped }],
	});

	const textBlock = response.content.find((block) => block.type === "text");
	const corrected = textBlock?.type === "text" ? textBlock.text : "";
	return restoreMarkup(corrected, spans);
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

// Mirrors getAlternativePosters, but for banners — only TMDB and IGDB have
// one at all (see bannerUrlFor), so MANGA/COMIC just return no options
// rather than erroring, and ImagePicker renders an empty grid for them.
export async function getAlternativeBanners(
	externalId: string,
	type: MediaType,
) {
	if (type === MediaType.MANGA || type === MediaType.COMIC) {
		return [];
	}

	if (type === MediaType.GAME) {
		// Unlike covers (one default + game_localizations' regional variants),
		// IGDB's artworks are already a flat list on the game object itself —
		// no second query needed. t_screenshot_med keeps the thumb landscape
		// (t_thumb would square-crop it) — see poster-resolver.ts's bannerUrlFor
		// for the full-size template the preview/save path uses.
		const game = await fetchIgdbGameById(externalId);
		return (game.artworks ?? [])
			.slice()
			.sort((a, b) => artworkAspectRatioDiff(a) - artworkAspectRatioDiff(b))
			.map((artwork) => ({
				filePath: artwork.image_id,
				thumbSrc: buildProxiedImageUrl(
					`https://images.igdb.com/igdb/image/upload/t_screenshot_med/${artwork.image_id}.jpg`,
				),
				previewSrc: buildProxiedImageUrl(bannerUrlFor(type, artwork.image_id)),
			}));
	}

	const images = await fetchTmdbImages(externalId, type);
	return images.backdrops
		.slice()
		.sort((a, b) => b.vote_average - a.vote_average)
		.map((backdrop) => ({
			filePath: backdrop.file_path,
			thumbSrc: buildProxiedImageUrl(
				`https://image.tmdb.org/t/p/w300${backdrop.file_path}`,
			),
			previewSrc: buildProxiedImageUrl(bannerUrlFor(type, backdrop.file_path)),
		}));
}

export async function updateMediaBanner(mediaId: number, bannerPath: string) {
	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { bannerPath: true, type: true },
	});

	await db.media.update({ where: { id: mediaId }, data: { bannerPath } });

	if (existing?.bannerPath !== bannerPath) {
		await db.mediaChangeLog.create({
			data: {
				mediaId,
				field: "bannerPath",
				oldValue: existing?.bannerPath ?? null,
				newValue: bannerPath,
			},
		});
	}

	const bannerSrc = await resolveBanner(mediaId, existing!.type, bannerPath);
	revalidatePath("/");
	return bannerSrc;
}
