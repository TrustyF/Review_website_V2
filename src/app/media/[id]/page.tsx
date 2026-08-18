import { ReactNode, Suspense } from "react";
import { notFound } from "next/navigation";
import { getMediaCore } from "./get-media";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { StarIcon } from "@/components/media/icons/star-icon";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { EnrichedAgo } from "@/components/media/primitives/enriched-ago";
import { formatRuntime } from "@/components/media/primitives/runtime";
import { PosterEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/poster-edit-trigger";
import { BannerEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/banner-edit-trigger";
import { ReviewBodyEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/review-body-edit-trigger";
import { AddToListButtonSection } from "@/components/lists/add-to-list-button/add-to-list-button-section";
import { AddToWatchlistButtonSection } from "@/components/watchlist/add-to-watchlist-button/add-to-watchlist-button-section";
import { auth } from "@/auth";
import { BANNER_GRAIN_OPACITY } from "@/server/resolvers/poster-resolver";
import { MediaDirectorCredit, MediaCreditsDetails } from "./credits-section";
import { MediaChangeLogSection } from "./change-log-section";
import styles from "./media-detail.module.sass";
import { CircularGauge } from "@/components/ui/circular-gauge";
import { Tooltip } from "@/components/ui/tooltip";
import { generateMediaMetadata } from "./metadata";

// See metadata.ts — kept there rather than inlined here so this file stays
// about rendering the page, not also building link-preview tags.
export const generateMetadata = generateMediaMetadata;

const CurrencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	notation: "compact",
	maximumFractionDigits: 1,
});

function Fact({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className={styles.fact}>
			<dt className={styles.fact_label}>{label}</dt>
			<dd className={styles.fact_value}>{value}</dd>
		</div>
	);
}

// Renders the handful of fields that differ between media types — each type
// keeps its data on a different relation (media.movie, media.tvShow, ...),
// so this just picks the right one and lays out whichever fields are set.
function MediaTypeFacts({ media }: { media: MediaRecord }) {
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
					{network && <Fact label="Network" value={network} />}
					{seasonCount != null && (
						<Fact label="Seasons" value={String(seasonCount)} />
					)}
					{episodeCount != null && (
						<Fact label="Episodes" value={String(episodeCount)} />
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
						<Fact label="Volumes" value={String(source.volumeCount)} />
					)}
					{source.chapterCount != null && (
						<Fact label="Chapters" value={String(source.chapterCount)} />
					)}
				</dl>
			);
		}
		case "GAME": {
			const { platform } = media.game;
			return (
				<dl className={styles.facts}>
					{platform && <Fact label="Platform" value={platform} />}
				</dl>
			);
		}
		case "BOOK": {
			const { pageCount, isbn } = media.book;
			return (
				<dl className={styles.facts}>
					{pageCount != null && (
						<Fact label="Pages" value={String(pageCount)} />
					)}
					{isbn && <Fact label="ISBN" value={isbn} />}
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

	// auth() is JWT-only (see src/auth.ts) — never hits the DB, so there's no
	// cost to awaiting it up front alongside the one query the rest of this
	// page's content actually depends on. AddToListButtonSection/
	// AddToWatchlistButtonSection/MediaDirectorCredit/MediaCreditsDetails/
	// MediaChangeLogSection all run their own queries independently, each
	// wrapped in its own <Suspense> below, so a slow credits or change-log
	// query no longer blocks the banner/title/facts (which only ever needed
	// getMediaCore's own result) from rendering.
	const session = await auth();
	const raw = await getMediaCore(mediaId);
	if (!raw) notFound();
	// Soft-deleted media stays visible to admins only, so the editor's own
	// restore flow (the isDeleted banner further down) still works — everyone
	// else gets the same 404 as a nonexistent id.
	if (raw.isDeleted && session?.user?.role !== "ADMIN") notFound();

	const media = toMediaRecord(raw);

	// Only movies/shorts carry a tagline (see MediaTypeFacts) — pulled out
	// here too since it now sits in the header's meta row, next to the
	// release date, rather than down in the type-specific facts list.
	const tagline =
		media.type === "MOVIE" || media.type === "SHORT"
			? media.movie.tagline
			: null;
	// Same story for runtime — it now sits in the info container under the
	// poster instead of the type-specific facts list.
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

	return (
		<div className={styles.wrapper}>
			{raw.isDeleted && (
				<div className={styles.deleted_banner}>
					This item is soft-deleted — hidden from every list. Open the editor to
					restore it or delete it permanently.
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
						{runtimeLabel && (
							<div className={styles.poster_info}>{runtimeLabel}</div>
						)}
						{session?.user && (
							<div className={styles.controls_bar}>
								<Suspense fallback={null}>
									<AddToWatchlistButtonSection
										mediaId={media.id}
										userId={session.user.id}
									/>
								</Suspense>
							</div>
						)}
					</div>
					<div className={styles.header_info}>
						<div className={styles.title_row}>
							<div className={styles.title_group}>
								<MediaTitle title={media.title} className={styles.title} />
								<Suspense fallback={null}>
									<MediaDirectorCredit mediaId={media.id} />
								</Suspense>
							</div>
							<div className={styles.title_actions}>
								<MediaEditButton media={media} className={styles.edit_button} />
							</div>
						</div>
						{media.alternateTitle && (
							<div className={styles.alt_title}>{media.alternateTitle}</div>
						)}

						<div className={styles.meta_row}>
							<MediaReleaseDate date={media.releaseDate} />
							{tagline && <span className={styles.tagline}>{tagline}</span>}
							<EnrichedAgo lastEnrichedAt={media.lastEnrichedAt} />
						</div>

						<div className={styles.review_row}>
							<div className={styles.review_col}>
								<ReviewBodyEditTrigger media={media} />
							</div>
							{(publicRating != null ||
								difficulty === 1 ||
								difficulty === 2 ||
								budget != null ||
								revenue != null ||
								roi != null) && (
								<div className={styles.secondary_facts}>
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
													? "Medium difficulty"
													: "Hard difficulty"
											}>
											<div className={styles.difficulty}>
												<span
													className={`${styles.difficulty_dot} ${difficulty === 1 ? styles.difficulty_dot_medium : styles.difficulty_dot_hard}`}
												/>
												{difficulty === 1 ? "Medium" : "Hard"}
											</div>
										</Tooltip>
									)}
									{(budget != null || revenue != null || roi != null) && (
										<div className={styles.finance_group}>
											<dl className={styles.financials_facts}>
												{budget != null && (
													<Fact
														label="Budget"
														value={CurrencyFormatter.format(budget)}
													/>
												)}
												{revenue != null && (
													<Fact
														label="Revenue"
														value={CurrencyFormatter.format(revenue)}
													/>
												)}
											</dl>
											{roi != null && (
												<Tooltip content="Return on investment">
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
				</div>

				<section className={styles.section}>
					<h2 className={styles.section_title}>Details</h2>
					{media.overview && (
						<p className={styles.overview}>{media.overview}</p>
					)}

					<MediaTypeFacts media={media} />

					<Suspense fallback={null}>
						<MediaCreditsDetails mediaId={media.id} />
					</Suspense>
				</section>

				<section className={styles.section}>
					<h2 className={styles.section_title}>Change log</h2>
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
	);
}
