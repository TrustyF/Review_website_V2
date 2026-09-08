import { db } from "@/server/db/client";
import {
	resolveEmailBanner,
	resolveEmailPoster,
} from "@/server/resolvers/poster-resolver";
import { toAbsoluteUrl } from "@/server/email/mailer";
import type LatestActivityEmail from "@/emails/latest-activity-email";
import {
	EnrichmentStatus,
	MediaStatus,
	MediaType,
	UserRole,
} from "@prisma/client";

// Shared by send-weekly-digest.ts (real send) and admin preview route — same query/prop logic, so preview always matches what gets mailed.

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENT_WATCHES = 6;
const MAX_LATEST_REVIEWS = 3;
const MAX_ANTICIPATED_RELEASES = 6;
// Duplicated from home-page windows (selects different fields).
const ANTICIPATED_RECENT_MONTHS = 5;
const ANTICIPATED_SOON_MONTHS = 2;
const SCREEN_MEDIA_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
];

const MEDIA_SELECT = {
	id: true,
	title: true,
	type: true,
	posterPath: true,
	bannerPath: true,
	externalId: true,
	releaseDate: true,
} as const;

type MediaSelection = {
	id: number;
	title: string;
	type: MediaType;
	posterPath: string | null;
	bannerPath: string | null;
	externalId: string | null;
	releaseDate: Date | null;
};

const PLACEHOLDER_POSTER_SRC = "/posters/placeholder.jpg";

async function toPosterSrc(media: MediaSelection): Promise<string> {
	if (!media.posterPath) return toAbsoluteUrl(PLACEHOLDER_POSTER_SRC);
	const src = await resolveEmailPoster(
		media.id,
		media.type,
		media.externalId,
		media.posterPath,
	);
	return toAbsoluteUrl(src);
}

async function toBannerSrc(media: MediaSelection): Promise<string | null> {
	const src = await resolveEmailBanner(
		media.id,
		media.type,
		media.externalId,
		media.bannerPath,
		media.posterPath,
	);
	return src ? toAbsoluteUrl(src) : null;
}

function formatWatchedDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

// Long month, matching the banner's "WEEKLY DIGEST · <date>" subtitle —
// distinct from formatWatchedDate's shorter "Aug 12, 2026" review byline.
function formatDigestDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

// Admin watchlist: UPCOMING within ANTICIPATED_SOON_MONTHS or ANTICIPATED_RECENT_MONTHS, not rated.
async function getAnticipatedReleases(): Promise<MediaSelection[]> {
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - ANTICIPATED_RECENT_MONTHS);
	const soonCutoff = new Date();
	soonCutoff.setMonth(soonCutoff.getMonth() + ANTICIPATED_SOON_MONTHS);

	const items = await db.watchlistItem.findMany({
		where: {
			user: { role: UserRole.ADMIN },
			media: {
				type: { in: SCREEN_MEDIA_TYPES },
				enrichmentStatus: EnrichmentStatus.DONE,
				isAdult: false,
				isDeleted: false,
				OR: [
					{
						status: MediaStatus.UPCOMING,
						releaseDate: { gte: new Date(), lte: soonCutoff },
					},
					{ releaseDate: { gte: cutoff } },
				],
				NOT: { review: { rating: { not: null } } },
			},
		},
		include: { media: { select: MEDIA_SELECT } },
		orderBy: { media: { releaseDate: { sort: "asc", nulls: "last" } } },
		take: MAX_ANTICIPATED_RELEASES,
		distinct: ["mediaId"],
	});

	return items.map((item) => item.media);
}

// Per-recipient URL (signed with recipient's user id), built by caller
export type DigestEmailProps = Omit<
	Parameters<typeof LatestActivityEmail>[0],
	"unsubscribeUrl"
>;

// null when no rating/review activity past week (digest skipped; preview has nothing real to render). Same admin-content scope as activity-actions.ts's getActivityFeed.
export async function buildDigestEmailProps(): Promise<DigestEmailProps | null> {
	const since = new Date(Date.now() - DIGEST_WINDOW_MS);

	const [latestReviewed, recentlyRated] = await Promise.all([
		// Manually curated via /admin/digest's review picker, not auto-picked
		// by recency — see rating.prisma's `inDigest` field.
		db.review.findMany({
			where: {
				inDigest: true,
				media: { isAdult: false, isDeleted: false },
			},
			orderBy: [
				{ reviewDate: { sort: "desc", nulls: "last" } },
				{ createDate: "desc" },
			],
			take: MAX_LATEST_REVIEWS,
			select: {
				mediaId: true,
				rating: true,
				initialRating: true,
				reviewDate: true,
				body: true,
				media: { select: MEDIA_SELECT },
			},
		}),
		db.review.findMany({
			where: {
				createDate: { gte: since },
				media: { isAdult: false, isDeleted: false },
			},
			orderBy: { createDate: "desc" },
			take: MAX_RECENT_WATCHES + MAX_LATEST_REVIEWS,
			select: {
				mediaId: true,
				rating: true,
				initialRating: true,
				media: { select: MEDIA_SELECT },
			},
		}),
	]);

	if (latestReviewed.length === 0 && recentlyRated.length === 0) return null;

	const anticipatedReleasesRaw = await getAnticipatedReleases();
	const anticipatedReleases = await Promise.all(
		anticipatedReleasesRaw.map(async (media) => ({
			title: media.title,
			mediaUrl: toAbsoluteUrl(`/media/${media.id}`),
			posterSrc: await toPosterSrc(media),
			rating: null,
		})),
	);

	const latestReviews = await Promise.all(
		latestReviewed.map(async (review) => ({
			title: review.media.title,
			mediaUrl: toAbsoluteUrl(`/media/${review.mediaId}`),
			posterSrc: await toPosterSrc(review.media),
			releaseYear: review.media.releaseDate
				? String(review.media.releaseDate.getFullYear())
				: null,
			rating: review.initialRating ?? review.rating,
			watchedDateLabel: formatWatchedDate(review.reviewDate!),
			body: review.body,
		})),
	);

	const latestReviewedMediaIds = new Set(
		latestReviewed.map((review) => review.mediaId),
	);
	const recentWatches = await Promise.all(
		recentlyRated
			.filter((review) => !latestReviewedMediaIds.has(review.mediaId))
			.slice(0, MAX_RECENT_WATCHES)
			.map(async (review) => ({
				title: review.media.title,
				mediaUrl: toAbsoluteUrl(`/media/${review.mediaId}`),
				posterSrc: await toPosterSrc(review.media),
				rating: review.initialRating ?? review.rating,
			})),
	);

	// Admin override always wins over automatic backdrop.
	const settings = await db.settings.findUnique({ where: { id: 1 } });
	const featuredMedia =
		latestReviewed[0]?.media ?? recentlyRated[0]?.media ?? null;
	const bannerSrc = settings?.digestBannerImage
		? toAbsoluteUrl(settings.digestBannerImage)
		: featuredMedia
			? await toBannerSrc(featuredMedia)
			: null;

	return {
		bannerSrc,
		dateLabel: formatDigestDate(new Date()),
		bannerHeadline: settings?.digestBannerHeadline,
		bannerSubtitle: settings?.digestBannerSubtitle,
		latestReviews,
		recentWatches,
		anticipatedReleases,
		activityUrl: toAbsoluteUrl("/activity"),
		accountUrl: toAbsoluteUrl("/account/settings"),
	};
}
