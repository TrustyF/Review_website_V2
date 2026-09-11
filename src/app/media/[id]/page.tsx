import { ReactNode, Suspense } from "react";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getMediaCore } from "./get-media";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { StarIcon } from "@/components/media/icons/star-icon";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { formatRuntime } from "@/components/media/primitives/runtime";
import { PosterEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/poster-edit-trigger";
import { BannerEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/banner-edit-trigger";
import { MediaPublishButton } from "@/components/media/media-management/media-detail-inline-editor/media-publish-button";
import { ReviewBodyEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/review-body-edit-trigger";
import { AddToListButtonSection } from "@/components/lists/add-to-list-button/add-to-list-button-section";
import { AddToWatchlistButtonSection } from "@/components/watchlist/add-to-watchlist-button/add-to-watchlist-button-section";
import { WatchedButtonSection } from "@/components/watched/watched-button/watched-button-section";
import { auth } from "@/auth";
import { BANNER_GRAIN_OPACITY } from "@/server/resolvers/poster-resolver";
import { MediaDirectorCredit, MediaCreditsDetails } from "./credits-section";
import { MediaChangeLogSection } from "./change-log-section";
import styles from "./media-detail.module.sass";
import { CircularGauge } from "@/components/ui/circular-gauge";
import { Tooltip } from "@/components/ui/tooltip";
import { generateMediaMetadata } from "./metadata";
import { MediaStatus } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLocale } from "@/lib/i18n/get-locale";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

// See metadata.ts — kept there rather than inlined here so this file stays
// about rendering the page, not also building link-preview tags.
export const generateMetadata = generateMediaMetadata;

const CurrencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	notation: "compact",
	maximumFractionDigits: 1,
});

// Covers a confirmed future date and a title merely announced/in-production
// with no date yet (e.g. TMDB "In Production" — see tv-show.ts's TV_STATUS_MAP).
function isUpcomingRelease(
	releaseDate: Date | null,
	status: MediaStatus,
): boolean {
	if (status === MediaStatus.ANNOUNCED || status === MediaStatus.UPCOMING)
		return true;
	return releaseDate != null && releaseDate.getTime() > Date.now();
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className={styles.fact}>
			<dt className={styles.fact_label}>{label}</dt>
			<dd className={styles.fact_value}>{value}</dd>
		</div>
	);
}

// Renders fields that differ between media types — each keeps its data on a
// different relation (media.movie, media.tvShow, ...), picked here by type.
function MediaTypeFacts({
	media,
	dict,
}: {
	media: MediaRecord;
	dict: Dictionary;
}) {
	const facts = dict.mediaDetail.facts;
	switch (media.type) {
		// Budget/revenue/ROI render in the financials box beside the review
		// instead — nothing left here for movies/shorts.
		case "MOVIE":
		case "SHORT":
			return null;
		case "TVSHOW": {
			const { seasonCount, episodeCount, network } = media.tvShow;
			return (
				<dl className={styles.facts}>
					{network && <Fact label={facts.network} value={network} />}
					{seasonCount != null && (
						<Fact label={facts.seasons} value={String(seasonCount)} />
					)}
					{episodeCount != null && (
						<Fact label={facts.episodes} value={String(episodeCount)} />
					)}
				</dl>
			);
		}
		case "MANGA":
		case "COMIC": {
			const source = media.type === "MANGA" ? media.manga : media.comic;
			return (
				<dl className={styles.facts}>
					{source.volumeCount != null && (
						<Fact label={facts.volumes} value={String(source.volumeCount)} />
					)}
					{source.chapterCount != null && (
						<Fact label={facts.chapters} value={String(source.chapterCount)} />
					)}
				</dl>
			);
		}
		case "GAME": {
			const { platform } = media.game;
			return (
				<dl className={styles.facts}>
					{platform && <Fact label={facts.platform} value={platform} />}
				</dl>
			);
		}
		case "BOOK": {
			const { pageCount, isbn } = media.book;
			return (
				<dl className={styles.facts}>
					{pageCount != null && (
						<Fact label={facts.pages} value={String(pageCount)} />
					)}
					{isbn && <Fact label={facts.isbn} value={isbn} />}
				</dl>
			);
		}
	}
}

export default async function MediaDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const mediaId = Number(id);
	if (!Number.isFinite(mediaId)) notFound();

	const dict = await getDictionary();
	const locale = await getLocale();
	// auth() is JWT-only (src/auth.ts), never hits the DB, so it's free to await
	// up front. Slower sections below run their own queries in their own <Suspense>.
	const session = await auth();
	const raw = await getMediaCore(mediaId);
	if (!raw) notFound();
	// Soft-deleted media stays visible to admins only (the isDeleted banner's
	// restore flow); everyone else gets the same 404 as a nonexistent id.
	if (raw.isDeleted && session?.user?.role !== "ADMIN") notFound();

	const media = toMediaRecord(raw);

	// Falls back to English when untranslated, like Review.bodyFr — see
	// Media.overviewFr. Title is localized inside MediaTitle instead.
	const overview =
		locale === "fr" ? (media.overviewFr ?? media.overview) : media.overview;

	// Only movies/shorts carry a tagline; falls back to English when untranslated, same as overview.
	const tagline =
		media.type === "MOVIE" || media.type === "SHORT"
			? locale === "fr"
				? (media.movie.taglineFr ?? media.movie.tagline)
				: media.movie.tagline
			: null;
	// Same story for runtime — it now sits in the secondary-facts block
	// beside the review instead of the type-specific facts list.
	const runtime =
		media.type === "MOVIE" || media.type === "SHORT"
			? media.movie.runtime
			: null;
	const runtimeLabel =
		runtime != null ? (formatRuntime(runtime) ?? `${runtime}m`) : null;
	// Same story for budget/revenue/ROI — they now sit in the financials box
	// beside the review instead of the type-specific facts list.
	const budget =
		media.type === "MOVIE" || media.type === "SHORT"
			? media.movie.budget
			: null;
	const revenue =
		media.type === "MOVIE" || media.type === "SHORT"
			? media.movie.revenue
			: null;
	const roi =
		budget != null && revenue != null && budget !== 0
			? (revenue - budget) / budget
			: null;
	// Not type-specific (unlike tagline/runtime/budget/revenue above) — every
	// media type can carry a source's public rating.
	const publicRating = raw.publicRating;
	// null/0 both mean "not rated for difficulty" — same convention
	// MediaPoster's own corner notch uses (see poster.tsx).
	const difficulty = raw.review?.difficulty;
	// Computed here (not inside ReviewBodyEditTrigger) since comparing against
	// Date.now() during a client component's render trips react-hooks/purity.
	const isUpcoming = isUpcomingRelease(media.releaseDate, raw.status);

	return (
		<div className={styles.page}>
			<div className={styles.wrapper}>
				{raw.isDeleted && (
					<div className={styles.deleted_banner}>
						{dict.mediaDetail.deletedBanner}
					</div>
				)}
				{media.bannerSrc && (
					<div className={styles.banner_wrapper}>
						<BannerEditTrigger
							media={media}
							bannerSrc={media.bannerSrc}
							bannerClassName={styles.banner}
							visualClassName={styles.banner_visual}
							imageClassName={styles.banner_image}
							backdropClassName={styles.banner_backdrop}
							grainOpacity={BANNER_GRAIN_OPACITY}
						/>
					</div>
				)}
				{media.bannerSrc && <div className={styles.banner_spacer} />}
				{!media.bannerSrc && <div className={styles.no_banner_spacer} />}

				<div className={styles.details_wrapper}>
					<div className={styles.header}>
						<div className={styles.poster_column}>
							<div className={styles.poster}>
								<PosterEditTrigger
									media={media}
									ratio={posterRatioFor(media.type)}
								/>
								<Suspense fallback={null}>
									<AddToListButtonSection
										mediaId={media.id}
										className={styles.list_button_float}
									/>
								</Suspense>
							</div>
							{(session?.user || media.sourceUrl) && (
								<div className={styles.controls_bar}>
									{session?.user && (
										<Suspense fallback={null}>
											<AddToWatchlistButtonSection
												mediaId={media.id}
												userId={session.user.id}
											/>
										</Suspense>
									)}
									{session?.user && (
										<Suspense fallback={null}>
											<WatchedButtonSection
												mediaId={media.id}
												type={media.type}
												userId={session.user.id}
											/>
										</Suspense>
									)}
									{media.sourceUrl && (
										<a
											href={media.sourceUrl}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.source_link_button}
											title={dict.mediaDetail.openOriginalSource}
											aria-label={dict.mediaDetail.openOriginalSource}>
											<ExternalLink size={15} />
										</a>
									)}
								</div>
							)}
						</div>
						<div className={styles.header_info}>
							<div className={styles.title_row}>
								<div className={styles.title_group}>
									<MediaTitle
										title={media.title}
										titleFr={media.titleFr}
										className={styles.title}
									/>
									<Suspense fallback={null}>
										<MediaDirectorCredit mediaId={media.id} type={media.type} />
									</Suspense>
								</div>
							</div>
							{tagline && <p className={styles.tagline}>{tagline}</p>}
							{media.alternateTitle && (
								<div className={styles.alt_title}>{media.alternateTitle}</div>
							)}

							<div className={styles.review_row}>
								<div className={styles.review_col}>
									<ReviewBodyEditTrigger
										media={media}
										isUpcoming={isUpcoming}
									/>
								</div>
								{(media.releaseDate != null ||
									runtimeLabel != null ||
									publicRating != null ||
									difficulty === 1 ||
									difficulty === 2 ||
									budget != null ||
									revenue != null ||
									roi != null) && (
									<div className={styles.secondary_facts}>
										<MediaReleaseDate date={media.releaseDate} />
										{runtimeLabel != null && (
											<div className={styles.finance_group}>
												<dl className={styles.financials_facts}>
													<Fact
														label={dict.mediaDetail.facts.runtime}
														value={runtimeLabel}
													/>
												</dl>
											</div>
										)}
										{publicRating != null && (
											<div className={styles.public_rating}>
												{publicRating.toFixed(1)}
												<StarIcon style={{ color: "var(--link)" }} />
											</div>
										)}
										{(difficulty === 1 || difficulty === 2) && (
											<Tooltip
												content={
													difficulty === 1
														? dict.mediaDetail.mediumDifficulty
														: dict.mediaDetail.hardDifficulty
												}>
												<div className={styles.difficulty}>
													<span
														className={`${styles.difficulty_dot} ${difficulty === 1 ? styles.difficulty_dot_medium : styles.difficulty_dot_hard}`}
													/>
													{difficulty === 1
														? dict.mediaDetail.medium
														: dict.mediaDetail.hard}
												</div>
											</Tooltip>
										)}
										{(budget != null || revenue != null || roi != null) && (
											<div className={styles.finance_group}>
												<dl className={styles.financials_facts}>
													{budget != null && (
														<Fact
															label={dict.mediaDetail.facts.budget}
															value={CurrencyFormatter.format(budget)}
														/>
													)}
													{revenue != null && (
														<Fact
															label={dict.mediaDetail.facts.revenue}
															value={CurrencyFormatter.format(revenue)}
														/>
													)}
												</dl>
												{roi != null && (
													<Tooltip
														content={dict.mediaDetail.returnOnInvestment}>
														<CircularGauge
															value={roi}
															size={40}
															strokeWidth={3}
															max={1}
															unit={"x"}
															textScaling={0.35}
														/>
													</Tooltip>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						</div>

						<MediaEditButton media={media} className={styles.edit_button} />
					</div>

					<section className={styles.section}>
						<h2 className={styles.section_title}>
							{dict.mediaDetail.detailsHeading}
						</h2>
						{overview && <p className={styles.overview}>{overview}</p>}

						<MediaTypeFacts media={media} dict={dict} />

						<Suspense fallback={null}>
							<MediaCreditsDetails mediaId={media.id} type={media.type} />
						</Suspense>
					</section>

					<section className={styles.section}>
						<h2 className={styles.section_title}>
							{dict.mediaDetail.changeLogHeading}
						</h2>
						<Suspense fallback={null}>
							<MediaChangeLogSection
								mediaId={media.id}
								type={raw.type}
								externalId={raw.externalId}
								review={raw.review}
							/>
						</Suspense>
					</section>
				</div>
			</div>

			<MediaPublishButton mediaId={media.id} />
		</div>
	);
}
