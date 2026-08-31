"use server";
import { db } from "@/server/db/client";
import { revalidatePath, updateTag } from "next/cache";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";
import { requireAdmin } from "@/lib/auth/require-admin";
import { MediaType } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTmdbImages } from "@/server/tmdb/client";
import { fetchMangaDexCovers } from "@/server/mangadex/client";
import { fetchComicVineIssuesForVolume } from "@/server/comicvine/client";
import {
	artworkAspectRatioDiff,
	artworksWithDimensions,
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
import type { PickableImage } from "@/components/media/media-management/media-editor/components/image-picker";
import { recordInvocation } from "@/server/dev/invocation-tracker";
import { REVIEW_MARKUP_REGEX } from "@/components/media/media-cards/media-card/review-body-syntax";
import { invalidateSearchIndex } from "@/components/search/search-actions";
import { revalidateMediaPaths } from "@/server/cache/revalidate-media";

// Paginated rather than all at once — each candidate costs a separate /api/image-proxy
// invocation once its thumbnail scrolls into view.
type Page<T> = { images: T[]; hasMore: boolean };

function paginate<T>(items: T[], offset: number, limit: number): Page<T> {
	return {
		images: items.slice(offset, offset + limit),
		hasMore: offset + limit < items.length,
	};
}

// Returns a MediaChangeLog row per field that actually changed. A field going from no prior
// value to having one is skipped too — it reads as noise ("— → 8"), not a real change. Enforced
// here as a hard invariant, not left to caller-by-caller guards.
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
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();

	// "Watched on" reads off Review.createDate, which only holds up if createDate never
	// predates an actual rating. Enforced here so it can't be bypassed by any other caller.
	if (review.rating == null) {
		throw new Error("A rating is required to save a review.");
	}

	// Same 0/1/2 (or null) domain the editor's number input clamps to, enforced here too so a
	// caller bypassing the UI can't write a value MediaPoster's notch logic wasn't meant to see.
	if (
		review.difficulty != null &&
		(!Number.isInteger(review.difficulty) ||
			review.difficulty < 0 ||
			review.difficulty > 2)
	) {
		throw new Error("Difficulty must be 0, 1, or 2.");
	}

	const [existing, media] = await Promise.all([
		db.review.findUnique({ where: { mediaId } }),
		db.media.findUniqueOrThrow({ where: { id: mediaId }, select: { type: true } }),
	]);

	// Set once, the first time body goes from unset to set. Keyed off reviewDate's presence
	// rather than re-derived every time, so clearing and rewriting the body later doesn't move it.
	const hadBody = Boolean(existing?.body?.trim());
	const hasBody = Boolean(review.body?.trim());
	const reviewDate =
		!existing?.reviewDate && !hadBody && hasBody ? new Date() : undefined;

	await db.review.upsert({
		where: { mediaId },
		update: { ...review, ...(reviewDate ? { reviewDate } : {}) },
		// initialRating only goes in the create branch — it never moves again once set, unlike `rating`.
		create: {
			mediaId,
			...review,
			initialRating: review.rating,
			...(reviewDate ? { reviewDate } : {}),
		},
	});

	// Only diff once a review already exists — the first save just creates it, and a wall of
	// "— → 8" entries for never-before-set fields isn't worth recording. Body/reviewDate stay
	// out of this — see change-log-list.tsx's synthesized "Reviewed on" entry instead.
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

	if (revalidate) {
		revalidateMediaPaths(mediaId, media.type);
		revalidatePath("/activity");
	}
}

// A rewatch has no field to diff — "watched it again", not "rating changed" — so it's logged
// directly on request. Repeatable, unlike "reviewed": every call adds another row.
export async function logRewatch(mediaId: number) {
	await requireAdmin();
	const [, media] = await Promise.all([
		db.mediaChangeLog.create({
			data: { mediaId, field: "rewatched", oldValue: null, newValue: "true" },
		}),
		db.media.findUniqueOrThrow({ where: { id: mediaId }, select: { type: true } }),
	]);
	revalidateMediaPaths(mediaId, media.type);
	revalidatePath("/activity");
}

// The one path that lets base Media fields be hand-edited, for media a provider has no
// (or wrong) data for.
export async function saveMediaDetails(
	mediaId: number,
	details: {
		title: string;
		overview: string | null;
		releaseDate: string | null;
		isAdult: boolean;
	},
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();

	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: {
			title: true,
			overview: true,
			releaseDate: true,
			isAdult: true,
			type: true,
		},
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
	if (revalidate) revalidateMediaPaths(mediaId, existing!.type);
}

// Soft delete just flips Media.isDeleted — public list queries filter it out, but the row and
// /media/[id] stay put so this toggle can restore it. @@unique([externalId, type]) still holds
// while soft-deleted, so re-adding from search collides; restoring here is the way back.
export async function setMediaDeleted(mediaId: number, isDeleted: boolean) {
	await requireAdmin();

	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { isDeleted: true, type: true },
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
	revalidateMediaPaths(mediaId, existing!.type);
}

// Irreversible: the row and every cascading relation (onDelete: Cascade in schema.prisma) are
// gone, so no change log entry follows. Cached poster/banner files are swept up later as orphans.
export async function hardDeleteMedia(mediaId: number) {
	await requireAdmin();
	const deleted = await db.media.delete({ where: { id: mediaId } });
	await invalidateSearchIndex();
	revalidateMediaPaths(mediaId, deleted.type);
}

const MARKUP_PLACEHOLDER_REGEX = /⟦MARKUP(\d+)⟧/g;

// Swaps every ||spoiler||/[text](url) span for a placeholder so the model never sees (and can't
// mangle) the syntax; restoreMarkup puts the spans back. Cost: text inside a span isn't proofread.
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

// Read-only — returns a suggested rewrite; the caller decides what to copy in.
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
	offset = 0,
	limit = 20,
): Promise<Page<PickableImage>> {
	await requireAdmin();
	recordInvocation("action:getAlternativePosters");

	if (type === MediaType.MANGA) {
		const covers = await fetchMangaDexCovers(externalId);
		return paginate(
			covers.map((cover) => ({
				filePath: cover.attributes.fileName,
				// Proxied rather than hotlinked so trying a poster doesn't depend on source hotlink support.
				thumbSrc: buildProxiedImageUrl(
					posterUrlFor(type, externalId, cover.attributes.fileName, "thumb"),
				),
				previewSrc: buildProxiedImageUrl(
					posterUrlFor(type, externalId, cover.attributes.fileName, "full"),
				),
			})),
			offset,
			limit,
		);
	}

	if (type === MediaType.COMIC) {
		// ComicVine has no alternate-cover concept at the volume level (unlike
		// TMDB/MangaDex) — each issue's own cover stands in for one instead.
		// filePath is a full URL rather than a path fragment, matching how
		// poster-resolver.ts stores/reads COMIC posterPaths.
		const issues = await fetchComicVineIssuesForVolume(externalId);
		return paginate(
			issues
				.filter((issue) => issue.image?.medium_url)
				.map((issue) => {
					const medium = issue.image!.medium_url!;
					return {
						filePath: medium,
						thumbSrc: buildProxiedImageUrl(issue.image!.small_url ?? medium),
						previewSrc: buildProxiedImageUrl(medium),
					};
				}),
			offset,
			limit,
		);
	}

	if (type === MediaType.GAME) {
		// A game's own game object only ever has one cover — IGDB.com's
		// "alternate covers" gallery is actually region-specific box art
		// (game_localizations), fetched and combined with the default cover
		// in fetchIgdbGameCoverOptions. filePath is a bare image_id, matching
		// how poster-resolver.ts stores/reads GAME posterPaths.
		const covers = await fetchIgdbGameCoverOptions(externalId);
		return paginate(
			covers.map((cover) => ({
				filePath: cover.imageId,
				thumbSrc: buildProxiedImageUrl(
					posterUrlFor(type, externalId, cover.imageId, "thumb"),
				),
				previewSrc: buildProxiedImageUrl(
					posterUrlFor(type, externalId, cover.imageId, "full"),
				),
			})),
			offset,
			limit,
		);
	}

	const images = await fetchTmdbImages(externalId, type);
	return paginate(
		images.posters
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
			})),
		offset,
		limit,
	);
}

// revalidate defaults to true for the full editor modal's one-click Save
// (see media-editor-modal.tsx's handleSave), which has no separate publish
// step of its own. The detail page's standalone PosterEditTrigger popover
// passes false and relies on MediaPublishButton's publishMediaEdits instead
// — see that component's own comment for why.
export async function updateMediaPoster(
	mediaId: number,
	posterPath: string,
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();
	recordInvocation("action:updateMediaPoster");

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

	// resolvePoster returns as soon as the source is downloaded and defers
	// the resize/encode/storage-write to after() — without Fluid Compute,
	// this Server Action would otherwise tie up the whole instance for as
	// long as it ran, blocking any other Server Action (e.g. the picker's
	// own alternates fetch) landing on the same instance behind it.
	await resolvePoster(mediaId, existing!.type, existing!.externalId, posterPath);
	if (revalidate) revalidateMediaPaths(mediaId, existing!.type);
	return `/api/poster/${mediaId}/${mediaAssetFilename(mediaId, posterPath)}`;
}

// Mirrors getAlternativePosters, but for banners — only TMDB and IGDB have
// one at all (see bannerUrlFor), so MANGA/COMIC just return no options
// rather than erroring, and ImagePicker renders an empty grid for them.
export async function getAlternativeBanners(
	externalId: string,
	type: MediaType,
	offset = 0,
	limit = 20,
): Promise<Page<PickableImage>> {
	await requireAdmin();
	recordInvocation("action:getAlternativeBanners");

	if (type === MediaType.MANGA || type === MediaType.COMIC) {
		return { images: [], hasMore: false };
	}

	if (type === MediaType.GAME) {
		// Unlike covers (one default + game_localizations' regional variants),
		// IGDB's artworks are already a flat list on the game object itself —
		// no second query needed. t_screenshot_med keeps the thumb landscape
		// (t_thumb would square-crop it) — see poster-resolver.ts's bannerUrlFor
		// for the full-size template the preview/save path uses.
		const game = await fetchIgdbGameById(externalId);
		return paginate(
			artworksWithDimensions(game.artworks ?? [])
				.slice()
				.sort((a, b) => artworkAspectRatioDiff(a) - artworkAspectRatioDiff(b))
				.map((artwork) => ({
					filePath: artwork.image_id,
					thumbSrc: buildProxiedImageUrl(
						`https://images.igdb.com/igdb/image/upload/t_screenshot_med/${artwork.image_id}.jpg`,
					),
					previewSrc: buildProxiedImageUrl(bannerUrlFor(type, artwork.image_id)),
				})),
			offset,
			limit,
		);
	}

	const images = await fetchTmdbImages(externalId, type);
	return paginate(
		images.backdrops
			.slice()
			.sort((a, b) => b.vote_average - a.vote_average)
			.map((backdrop) => ({
				filePath: backdrop.file_path,
				thumbSrc: buildProxiedImageUrl(
					`https://image.tmdb.org/t/p/w300${backdrop.file_path}`,
				),
				previewSrc: buildProxiedImageUrl(bannerUrlFor(type, backdrop.file_path)),
			})),
		offset,
		limit,
	);
}

// See updateMediaPoster's own comment on the revalidate param.
export async function updateMediaBanner(
	mediaId: number,
	bannerPath: string,
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();
	recordInvocation("action:updateMediaBanner");

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

	// See updateMediaPoster's own comment above — resolveBanner returns as
	// soon as the source is downloaded and defers the encode to after(), so
	// this Server Action doesn't tie up the instance and starve others.
	await resolveBanner(mediaId, existing!.type, bannerPath);
	if (revalidate) revalidateMediaPaths(mediaId, existing!.type);
	return `/api/banner/${mediaId}/${mediaAssetFilename(mediaId, bannerPath, BANNER_FORMAT)}`;
}

// Purely a display tweak (see Media.bannerFocusY) — not logged to the
// changelog, same reasoning as review body edits being excluded from the
// generic diff: a slider fires many updates per drag, and "nudged the
// framing" isn't a change worth a permanent record the way swapping the
// banner image itself is.
export async function updateMediaBannerFocus(
	mediaId: number,
	focusY: number,
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();
	recordInvocation("action:updateMediaBannerFocus");
	const clamped = Math.max(0, Math.min(100, Math.round(focusY)));
	await db.media.update({
		where: { id: mediaId },
		data: { bannerFocusY: clamped },
	});
	// Only /media/[id] ever renders the banner (see api/banner and
	// media-detail-inline-editor) — no catalog/home site-wide wipe needed for
	// a framing nudge. Still needs the cache tag, not just the path: the
	// route itself is dynamic (revalidatePath alone does nothing for it),
	// but getMediaCore's cached row (get-media.ts) carries bannerFocusY and
	// won't pick up this change on its own.
	if (revalidate) {
		revalidatePath(`/media/${mediaId}`);
		updateTag(mediaCacheTag(mediaId));
	}
}

// Fired by MediaPublishButton once an admin is done trying poster/banner/
// focus tweaks on the detail page (see PosterEditTrigger/BannerEditTrigger,
// which save with revalidate: false) — one revalidation for the whole
// editing session instead of one per pick/drag.
export async function publishMediaEdits(
	mediaId: number,
	// Set when the staged draft included a review body edit (see
	// media-publish-store.ts's pendingReview) — mirrors saveReview's own
	// revalidatePath("/activity"), which that call skips here via
	// revalidate: false.
	{ includeActivity = false }: { includeActivity?: boolean } = {},
): Promise<void> {
	await requireAdmin();
	recordInvocation("action:publishMediaEdits");
	const media = await db.media.findUniqueOrThrow({
		where: { id: mediaId },
		select: { type: true },
	});
	revalidateMediaPaths(mediaId, media.type);
	if (includeActivity) revalidatePath("/activity");
}

// Same one-revalidation-per-session idea as publishMediaEdits, for the full
// editor modal's Save button: saveReview/saveMediaDetails/updateMediaPoster/
// updateMediaBanner all run in parallel there and each save with
// revalidate: false, so this is the one call that actually refreshes
// anything once they're done. includeActivity mirrors saveReview's own
// revalidatePath("/activity") — only worth it when a review was actually
// part of this save.
export async function finalizeMediaEditorSave(
	mediaId: number,
	type: MediaType,
	{ includeActivity = false }: { includeActivity?: boolean } = {},
): Promise<void> {
	await requireAdmin();
	revalidateMediaPaths(mediaId, type);
	if (includeActivity) revalidatePath("/activity");
}
