import { db } from "@/server/db/client";
import {
	resolveChangelogPosterThumb,
	resolveEmailBanner,
} from "@/server/resolvers/poster-resolver";
import { toAbsoluteUrl } from "@/server/email/mailer";
import type LatestActivityEmail from "@/emails/latest-activity-email";
import {
	EnrichmentStatus,
	MediaStatus,
	MediaType,
	UserRole,
} from "@prisma/client";

// Shared by send-weekly-digest.ts (the real send) and the admin preview
// route — same query/prop-building logic, so the preview always matches
// what actually gets mailed.

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENT_WATCHES = 6;
const MAX_LATEST_REVIEWS = 3;
const MAX_ANTICIPATED_RELEASES = 6;
// Same home-page windows (src/app/page.tsx's getAnticipatedReleases) — kept
// duplicated rather than shared since the two queries select different media
// fields (this one only needs MEDIA_SELECT, not the movie/tvShow relations
// the home page's media grid needs).
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
	const src = await resolveChangelogPosterThumb(
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

// What's on the ADMIN account's watchlist that's worth anticipating — same
// rule as the home page's getAnticipatedReleases: UPCOMING with a confirmed
// date within ANTICIPATED_SOON_MONTHS, or released within
// ANTICIPATED_RECENT_MONTHS ("in theaters"), and not yet rated.
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

// unsubscribeUrl is per-recipient (signed with that recipient's user id), so
// it's built by the caller (send-weekly-digest.ts / the admin preview route)
// rather than here.
export type DigestEmailProps = Omit<
	Parameters<typeof LatestActivityEmail>[0],
	"unsubscribeUrl"
>;

// Null when there's no rating/review activity in the past week — the digest
// gets skipped that week (see send-weekly-digest.ts), and the preview route
// has nothing real to render either.
//
// Same admin-authored-content scope as activity-actions.ts's getActivityFeed
// — Review has no per-user owner on this single-admin site, so "what I rated
// and reviewed" means the admin's own activity, broadcast to every
// newsletterOptIn subscriber, not a personalized per-recipient query.
export async function buildDigestEmailProps(): Promise<DigestEmailProps | null> {
	const since = new Date(Date.now() - DIGEST_WINDOW_MS);

	const [latestReviewed, recentlyRated] = await Promise.all([
		db.review.findMany({
			where: {
				reviewDate: { gte: since },
				media: { isAdult: false, isDeleted: false },
			},
			orderBy: { reviewDate: "desc" },
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

	// Admin override (/admin/digest-banner) always wins over the automatic
	// featured-media backdrop — checked here rather than in toBannerSrc since
	// it's a pre-hosted URL with no media/type/externalId to resolve.
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
