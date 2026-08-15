"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
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
	BANNER_FORMAT,
	bannerUrlFor,
	mediaAssetFilename,
	posterUrlFor,
	resolveBanner,
	resolvePoster,
} from "@/server/resolvers/poster-resolver";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";
import { invalidateSearchIndex } from "@/components/search/search-actions";

// Compares old/new values field by field and returns a MediaChangeLog row
// for each one that actually changed — untouched fields produce no row. A
// field going from no prior value to having one isn't a "change" in that
// sense either — it's the field being set for the first time, which reads
// as noise ("— → 8") rather than a change worth recording — so that's
// skipped too, regardless of whether a caller's own guard (e.g. saveReview's
// `if (existing)`) already prevents it from happening. This is a hard
// invariant, not a caller-by-caller convention — 21 legacy rows for rating/
// liked/difficulty violating it (predating whatever guard was already here)
// were found and deleted when this was added.
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
		if (oldValue === null) continue;
		changes.push({
			mediaId,
			field,
			oldValue: String(oldValue),
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
		difficulty: number | null;
		body: string | null;
	},
) {
	await requireAdmin();

	// A rating is the one thing that has to exist for a review to mean
	// anything here — "Watched on" reads straight off Review.createDate now
	// (see toMediaRecord's watchedDate), which only holds up if createDate
	// can never predate an actual rating. Enforced here rather than left as
	// a UI nicety so it can't be bypassed by any other caller either.
	if (review.rating == null) {
		throw new Error("A rating is required to save a review.");
	}

	// Same 0/1/2 (or null) domain the editor's own number input clamps to
	// (see media-editor-modal.tsx) — enforced here too so a caller that
	// skips the UI can't write something MediaPoster's notch logic was
	// never meant to see.
	if (
		review.difficulty != null &&
		(!Number.isInteger(review.difficulty) ||
			review.difficulty < 0 ||
			review.difficulty > 2)
	) {
		throw new Error("Difficulty must be 0, 1, or 2.");
	}

	const existing = await db.review.findUnique({ where: { mediaId } });

	// Set once, the first time body actually goes from unset to set — see
	// this field's own comment in rating.prisma. Keyed off reviewDate's own
	// presence rather than re-derived from hadBody every time, so a body
	// cleared out and rewritten later doesn't move it.
	const hadBody = Boolean(existing?.body?.trim());
	const hasBody = Boolean(review.body?.trim());
	const reviewDate =
		!existing?.reviewDate && !hadBody && hasBody ? new Date() : undefined;

	await db.review.upsert({
		where: { mediaId },
		update: { ...review, ...(reviewDate ? { reviewDate } : {}) },
		create: { mediaId, ...review, ...(reviewDate ? { reviewDate } : {}) },
	});

	// Only log the usual field-by-field diff once a review already exists —
	// the very first save just creates it, and a wall of "— → 8" entries for
	// fields that never had a prior value isn't a change worth recording.
	// Body/reviewDate stay out of this — see change-log-list.tsx's
	// synthesized "Reviewed on" entry (sourced from reviewDate, same as
	// "Watched on" reads createDate) instead of a real changelog row here.
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

	revalidatePath("/", "layout");
}

// A rewatch has no field of its own to diff — it's not "rating changed",
// it's "watched it again" — so unlike everything else in this file it's
// logged directly on request rather than inferred from a before/after
// comparison. Repeatable (unlike "reviewed"): every call adds another
// "Rewatched on" row, one per actual rewatch.
export async function logRewatch(mediaId: number) {
	await requireAdmin();
	await db.mediaChangeLog.create({
		data: { mediaId, field: "rewatched", oldValue: null, newValue: "true" },
	});
	revalidatePath("/", "layout");
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
		isAdult: boolean;
	},
) {
	await requireAdmin();

	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { title: true, overview: true, releaseDate: true, isAdult: true },
	});

	const releaseDate = details.releaseDate
		? new Date(details.releaseDate)
		: null;

	await db.media.update({
		where: { id: mediaId },
		data: {
			title: details.title,
			overview: details.overview,
			releaseDate,
			isAdult: details.isAdult,
		},
	});

	const changes = diffFields(
		mediaId,
		{
			title: existing?.title,
			overview: existing?.overview,
			releaseDate: existing?.releaseDate?.toISOString().slice(0, 10) ?? null,
			isAdult: existing?.isAdult,
		},
		{
			title: details.title,
			overview: details.overview,
			releaseDate: releaseDate?.toISOString().slice(0, 10) ?? null,
			isAdult: details.isAdult,
		},
	);
	if (changes.length) {
		await db.mediaChangeLog.createMany({ data: changes });
	}

	await invalidateSearchIndex();
	revalidatePath("/", "layout");
}

// Soft delete just flips Media.isDeleted — every public list query filters
// it out (see src/app/page.tsx, media-type-list-page.tsx,
// credit-media-list-page.tsx), but the row (and its files, review, credits,
// change log) stays put, and /media/[id] stays directly reachable so this
// same toggle can restore it later. Note the @@unique([externalId, type])
// constraint still holds while soft-deleted — re-adding the same title from
// search will collide with it; restoring here is the way back, not search.
export async function setMediaDeleted(mediaId: number, isDeleted: boolean) {
	await requireAdmin();

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

	await invalidateSearchIndex();
	// "layout" already covers /media/${mediaId} too — see
	// media-add-actions.ts's comment on this same pattern.
	revalidatePath("/", "layout");
}

// Irreversible: the row itself is gone, and with it every relation that
// cascades from Media (Movie/TvShow/Manga/Comic/Game, Review, Credit,
// MediaGenre, MediaChangeLog — see onDelete: Cascade in schema.prisma). No
// change log entry follows, since there'd be nothing left for it to point
// at. Cached poster/banner files on disk aren't touched here — they're
// swept up as orphans by the next cleanup-posters run.
export async function hardDeleteMedia(mediaId: number) {
	await requireAdmin();
	await db.media.delete({ where: { id: mediaId } });
	await invalidateSearchIndex();
	revalidatePath("/", "layout");
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
	await requireAdmin();
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
	await requireAdmin();

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
	await requireAdmin();

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

	// Eagerly downloads/caches the new poster right now (its returned bytes
	// aren't needed here — see resolvePoster's own comment) so it's already
	// on disk the moment this save resolves, rather than lazily on whatever
	// request happens to hit /api/poster next.
	await resolvePoster(
		mediaId,
		existing!.type,
		existing!.externalId,
		posterPath,
	);
	revalidatePath("/", "layout");
	return `/api/poster/${mediaId}/${mediaAssetFilename(mediaId, posterPath)}`;
}

// Mirrors getAlternativePosters, but for banners — only TMDB and IGDB have
// one at all (see bannerUrlFor), so MANGA/COMIC just return no options
// rather than erroring, and ImagePicker renders an empty grid for them.
export async function getAlternativeBanners(
	externalId: string,
	type: MediaType,
) {
	await requireAdmin();

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
	await requireAdmin();

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

	// Same eager cache-on-save reasoning as updateMediaPoster above —
	// awaitEncode so the cache is actually warm by the time this returns,
	// not deferred like the /api/banner route's fast-first-byte path.
	await resolveBanner(mediaId, existing!.type, bannerPath, {
		awaitEncode: true,
	});
	revalidatePath("/", "layout");
	return `/api/banner/${mediaId}/${mediaAssetFilename(mediaId, bannerPath, BANNER_FORMAT)}`;
}

// Purely a display tweak (see Media.bannerFocusY) — not logged to the
// changelog, same reasoning as review body edits being excluded from the
// generic diff: a slider fires many updates per drag, and "nudged the
// framing" isn't a change worth a permanent record the way swapping the
// banner image itself is.
export async function updateMediaBannerFocus(mediaId: number, focusY: number) {
	await requireAdmin();
	const clamped = Math.max(0, Math.min(100, Math.round(focusY)));
	await db.media.update({
		where: { id: mediaId },
		data: { bannerFocusY: clamped },
	});
	revalidatePath("/", "layout");
}
