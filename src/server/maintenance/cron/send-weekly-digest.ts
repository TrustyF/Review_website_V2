import { db } from "@/server/db/client";
import {
	resolveChangelogPosterThumb,
	resolveEmailBanner,
} from "@/server/resolvers/poster-resolver";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import LatestActivityEmail from "@/emails/latest-activity-email";
import { appendJobSummary, formatSummaryList } from "./job-summary";
import type { MediaType } from "@prisma/client";

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

// Same admin-authored-content scope as activity-actions.ts's getActivityFeed
// — Review has no per-user owner on this single-admin site, so "what I rated
// and reviewed" means the admin's own activity, broadcast to every
// newsletterOptIn subscriber, not a personalized per-recipient query.
async function main() {
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

	if (!latestReviewed && recentlyRated.length === 0) {
		await appendJobSummary([
			"No rating/review activity in the past week — skipped.",
		]);
		return;
	}

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

	const featuredMedia =
		latestReviewed?.media ?? recentlyRated[0]?.media ?? null;
	const bannerSrc = featuredMedia ? await toBannerSrc(featuredMedia) : null;
	const dateLabel = formatDigestDate(new Date());

	const recipients = await db.user.findMany({
		where: { newsletterOptIn: true, email: { not: null } },
		select: { email: true },
	});

	for (const recipient of recipients) {
		await sendEmail({
			to: recipient.email!,
			subject: "What I've been watching",
			react: LatestActivityEmail({
				bannerSrc,
				dateLabel,
				latestReview,
				recentWatches,
				activityUrl: toAbsoluteUrl("/activity"),
				accountUrl: toAbsoluteUrl("/account/settings"),
			}),
		});
	}

	await appendJobSummary([
		`Sent weekly digest to ${recipients.length} subscriber(s).`,
		...formatSummaryList(recentWatches.map((w) => w.title)),
	]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
