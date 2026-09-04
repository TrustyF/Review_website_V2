import { db } from "@/server/db/client";
import {
	resolveChangelogPosterThumb,
	resolveEmailBanner,
} from "@/server/resolvers/poster-resolver";
import { toAbsoluteUrl } from "@/server/email/mailer";
import type LatestActivityEmail from "@/emails/latest-activity-email";
import type { MediaType } from "@prisma/client";

// Shared by send-weekly-digest.ts (the real send) and the admin preview
// route — same query/prop-building logic, so the preview always matches
// what actually gets mailed.

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENT_WATCHES = 6;

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

export type DigestEmailProps = Parameters<typeof LatestActivityEmail>[0];

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
		db.review.findFirst({
			where: {
				reviewDate: { gte: since },
				media: { isAdult: false, isDeleted: false },
			},
			orderBy: { reviewDate: "desc" },
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
			take: MAX_RECENT_WATCHES + 1,
			select: {
				mediaId: true,
				rating: true,
				initialRating: true,
				media: { select: MEDIA_SELECT },
			},
		}),
	]);

	if (!latestReviewed && recentlyRated.length === 0) return null;

	const latestReview = latestReviewed
		? {
				title: latestReviewed.media.title,
				mediaUrl: toAbsoluteUrl(`/media/${latestReviewed.mediaId}`),
				posterSrc: await toPosterSrc(latestReviewed.media),
				releaseYear: latestReviewed.media.releaseDate
					? String(latestReviewed.media.releaseDate.getFullYear())
					: null,
				rating: latestReviewed.initialRating ?? latestReviewed.rating,
				watchedDateLabel: formatWatchedDate(latestReviewed.reviewDate!),
				body: latestReviewed.body,
			}
		: null;

	const recentWatches = await Promise.all(
		recentlyRated
			.filter((review) => review.mediaId !== latestReviewed?.mediaId)
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
		latestReviewed?.media ?? recentlyRated[0]?.media ?? null;
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
		bannerPositionY: settings?.digestBannerPositionY,
		latestReview,
		recentWatches,
		activityUrl: toAbsoluteUrl("/activity"),
		accountUrl: toAbsoluteUrl("/account/settings"),
	};
}
