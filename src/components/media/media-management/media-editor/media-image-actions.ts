"use server";
import { db } from "@/server/db/client";
import { revalidatePath, updateTag } from "next/cache";
import { mediaCacheTag } from "@/server/cache/media-cache-tag";
import { requireAdmin } from "@/lib/auth/require-admin";
import { MediaType } from "@prisma/client";
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
	persistCroppedBanner,
	persistCroppedPoster,
	posterUrlFor,
	resolveBanner,
	resolvePoster,
} from "@/server/resolvers/poster-resolver";
import { readCroppedFile } from "@/server/resolvers/image-crop-resolver";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";
import type { PickableImage } from "@/components/media/media-management/media-editor/components/image-picker";
import { recordInvocation } from "@/server/dev/invocation-tracker";
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
		// ComicVine has no alternate-cover concept at the volume level; each issue's own cover stands
		// in. filePath is a full URL, matching how poster-resolver.ts stores/reads COMIC posterPaths.
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
		// A game object only ever has one cover — IGDB's "alternate covers" gallery is actually
		// region-specific box art (game_localizations), combined in fetchIgdbGameCoverOptions.
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

// revalidate defaults true for the editor modal's one-click Save (no separate publish step).
// The detail page's standalone PosterEditTrigger passes false, relying on MediaPublishButton's publishMediaEdits instead.
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

	// A custom crop's bytes live in the transient cropped/ store (swept after 24h) — persist them
	// directly rather than relying on resolvePoster's lazy fetch of a URL that later expires.
	const croppedBytes = await readCroppedFile(posterPath);
	if (croppedBytes) {
		await persistCroppedPoster(mediaId, posterPath, croppedBytes);
	} else {
		// resolvePoster returns as soon as the source downloads and defers the resize/encode/write
		// to after(), so this Server Action doesn't tie up the instance and block others behind it.
		await resolvePoster(
			mediaId,
			existing!.type,
			existing!.externalId,
			posterPath,
		);
	}
	if (revalidate) revalidateMediaPaths(mediaId, existing!.type);
	return `/api/poster/${mediaId}/${mediaAssetFilename(mediaId, posterPath)}`;
}

// Mirrors getAlternativePosters, but for banners — only TMDB/IGDB have one (see bannerUrlFor),
// so MANGA/COMIC return no options and ImagePicker renders an empty grid.
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
		// Unlike covers, IGDB's artworks are already a flat list on the game object — no second
		// query needed. t_screenshot_med keeps the thumb landscape (t_thumb would square-crop it).
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
					previewSrc: buildProxiedImageUrl(
						bannerUrlFor(type, artwork.image_id),
					),
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
				previewSrc: buildProxiedImageUrl(
					bannerUrlFor(type, backdrop.file_path),
				),
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

	// A custom crop's bytes live in the transient cropped/ store (swept after 24h) — persist them
	// directly rather than relying on resolveBanner's lazy fetch of a URL that later expires.
	const croppedBytes = await readCroppedFile(bannerPath);
	if (croppedBytes) {
		await persistCroppedBanner(mediaId, bannerPath, croppedBytes);
	} else {
		// resolveBanner returns as soon as the source downloads and defers the encode to
		// after(), so this Server Action doesn't tie up the instance (see updateMediaPoster).
		await resolveBanner(mediaId, existing!.type, bannerPath);
	}
	if (revalidate) revalidateMediaPaths(mediaId, existing!.type);
	return `/api/banner/${mediaId}/${mediaAssetFilename(mediaId, bannerPath, BANNER_FORMAT)}`;
}

// Purely a display tweak (Media.bannerFocusY) — not logged to the changelog, same as review
// body edits: a slider fires many updates per drag, not worth a permanent record.
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
	// Only /media/[id] renders the banner, so no site-wide wipe needed. Needs the cache tag
	// too, not just the path — getMediaCore's cached row carries bannerFocusY and won't pick up this change otherwise.
	if (revalidate) {
		revalidatePath(`/media/${mediaId}`);
		updateTag(mediaCacheTag(mediaId));
	}
}
