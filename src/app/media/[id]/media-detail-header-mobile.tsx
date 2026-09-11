import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaPoster } from "@/components/media/primitives/poster";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaReviewDisplay } from "@/components/media/media-cards/media-card/review";
import { AddToListButtonSection } from "@/components/lists/add-to-list-button/add-to-list-button-section";
import { AddToWatchlistButtonSection } from "@/components/watchlist/add-to-watchlist-button/add-to-watchlist-button-section";
import { WatchedButtonSection } from "@/components/watched/watched-button/watched-button-section";
import { MediaDirectorCredit } from "./credits-section";
import type { Session } from "next-auth";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import styles from "./media-detail-header-mobile.module.sass";
import pageStyles from "./media-detail.module.sass";

type Props = {
	media: MediaRecord;
	dict: Dictionary;
	session: Session | null;
	tagline: string | null;
	overview: string | null;
	runtimeLabel: string | null;
	isUpcoming: boolean;
};

// Mobile counterpart to page.tsx's desktop header, visibility swapped via CSS breakpoint
// (see .wrapper), like MediaCardShell/MediaCardShellMobile. No admin edit affordances
// (mobile edits are unsupported) — plain display components, not the *EditTrigger wrappers.
export function MediaDetailHeaderMobile({
	media,
	dict,
	session,
	tagline,
	overview,
	runtimeLabel,
	isUpcoming,
}: Props) {
	const quickFacts = [
		media.releaseDate != null ? media.releaseDate.getFullYear() : null,
		runtimeLabel,
	].filter((value) => value != null);

	return (
		<div className={styles.wrapper}>
			<div className={styles.poster_column}>
				<div className={styles.poster}>
					<MediaPoster
						src={media.posterSrc}
						title={media.title}
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
				{quickFacts.length > 0 && (
					<div className={styles.quick_facts}>{quickFacts.join(" · ")}</div>
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
				{overview && <p className={styles.overview}>{overview}</p>}
			</div>

			<div className={styles.review}>
				<h2 className={pageStyles.section_title}>{dict.mediaDetail.reviewHeading}</h2>
				<MediaReviewDisplay
					review={media.review}
					watchedDate={media.watchedDate}
					type={media.type}
					releaseDate={media.releaseDate}
					isUpcoming={isUpcoming}
					ratingClassName={styles.review_rating}
					dateClassName={styles.review_date}
					bodyClassName={styles.review_body}
				/>
			</div>
		</div>
	);
}
