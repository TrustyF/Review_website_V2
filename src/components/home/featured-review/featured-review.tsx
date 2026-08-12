import Image from "next/image";
import Link from "next/link";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBodyLine,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import styles from "./featured-review.module.sass";

type Props = {
	media: MediaRecord;
};

// The homepage's hero — the single most recently reviewed item (see
// app/page.tsx's query, ordered by Review.reviewDate). Not a MediaCardShell
// variant: this wants the banner as a full-width backdrop and only a teaser
// of the review body (first paragraph), both of which the grid-oriented
// cards don't do.
export function FeaturedReview({ media }: Props) {
	// Guards against a media row somehow reaching this component without a
	// reviewed body — shouldn't happen given the page's own query filter, but
	// keeps this safe to reuse without trusting every future caller to
	// replicate that filter exactly, same defensive shape as MediaReview's
	// own `if (!review) return null`.
	const review = media.review;
	if (!review?.body) return null;

	// Teaser only — the full body is one click away on the media page itself.
	// A few paragraphs rather than just the first, capped visually by
	// .excerpt's own line-clamp for anything longer.
	const paragraphs = review.body.split("\n\n").slice(0, 3);

	return (
		<Link href={`/media/${media.id}`} className={styles.wrapper}>
			{media.bannerSrc && (
				<div className={styles.banner}>
					<Image
						src={media.bannerSrc}
						alt=""
						fill
						sizes="(max-width: 950px) 100vw, 950px"
						className={styles.banner_image}
						style={{ objectPosition: `50% ${media.bannerFocusY}%` }}
						// Same reasoning as every other /api/banner consumer (see
						// MediaPoster's own comment) — that route already resizes
						// and re-encodes server-side.
						unoptimized
						priority
					/>
					<div className={styles.banner_backdrop} />
				</div>
			)}
			<div
				className={`${styles.content} ${media.bannerSrc ? styles.content_overlap : ""}`}
			>
				<div className={styles.poster}>
					<MediaPoster
						src={media.posterSrc}
						title={media.title}
						ratio={posterRatioFor(media.type)}
					/>
				</div>
				<div className={styles.info}>
					<div className={styles.eyebrow}>Latest review</div>
					<h1 className={styles.title}>{media.title}</h1>
					<div className={styles.meta_row}>
						<MediaReleaseDate date={media.releaseDate} />
						{review.rating != null && (
							<div className={styles.rating}>
								{review.rating}
								<StarIcon size={14} />
							</div>
						)}
					</div>
					<div className={styles.excerpt}>
						<ReviewSpoilerProvider>
							{paragraphs.map((paragraph, index) => (
								<p className={styles.excerpt_line} key={index}>
									<ReviewBodyLine text={paragraph} />
								</p>
							))}
						</ReviewSpoilerProvider>
					</div>
					<span className={styles.read_more}>Read full review →</span>
				</div>
			</div>
		</Link>
	);
}
