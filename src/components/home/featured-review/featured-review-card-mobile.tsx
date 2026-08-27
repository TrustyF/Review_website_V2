import { CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBody,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import { eyebrowFor, EXCERPT_MAX_BLOCKS } from "./featured-review-shared";
import styles from "./featured-review-card-mobile.module.sass";

type Props = {
	media: MediaRecord & { review: NonNullable<MediaRecord["review"]> };
	direction: 1 | -1;
	exiting?: boolean;
};

// Mobile-width counterpart to FeaturedReviewCard — same fixed 180px poster
// beside the info column squeezes .info down to almost nothing once the
// wrapper itself drops below ~450px (poster + gap + padding alone already
// eat that much), so this drops the poster into a small grid cell beside
// the title/meta instead, same "give the narrow viewport its own layout"
// move as MediaCardShellMobile makes for the regular grid cards. Swapped in
// via CSS ($mobile-breakpoint, mirrored in each module's own .card_link)
// rather than a client-side matchMedia check, same reasoning as that file:
// FeaturedReview already re-renders both on every transition regardless, so
// there's no first-paint flash to worry about either way.
export function FeaturedReviewCardMobile({ media, direction, exiting = false }: Props) {
	const [settled, setSettled] = useState(exiting);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setSettled(!exiting));
		return () => cancelAnimationFrame(frame);
	}, [exiting]);

	const excerptRef = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	useEffect(() => {
		const el = excerptRef.current;
		if (el) setIsOverflowing(el.scrollHeight > el.clientHeight);
	}, []);

	const review = media.review;
	const eyebrow = eyebrowFor(review);
	const EyebrowIcon = eyebrow.icon;

	const offset = exiting ? 0 : direction * 2;

	return (
		<Link
			href={`/media/${media.id}`}
			className={`${styles.card_link} ${settled ? styles.settled : ""} ${exiting ? styles.exiting : ""}`}
			style={{ "--enter-offset": `${offset}rem` } as CSSProperties}
			aria-hidden={exiting || undefined}
			tabIndex={exiting ? -1 : undefined}>
			{media.bannerSrc && (
				<div className={styles.banner}>
					<Image
						src={media.bannerSrc}
						alt=""
						fill
						sizes="100vw"
						className={styles.banner_image}
						style={{ objectPosition: `50% ${media.bannerFocusY}%` }}
						unoptimized
						priority
					/>
					<div className={styles.banner_backdrop} />
				</div>
			)}
			<div
				className={`${styles.content_clip} ${media.bannerSrc ? styles.content_overlap : ""}`}>
				<div className={styles.content}>
					<div className={styles.poster}>
						<MediaPoster
							src={media.posterSrc}
							title={media.title}
							ratio={posterRatioFor(media.type)}
						/>
					</div>
					<div className={styles.top}>
						<div className={styles.eyebrow}>
							{EyebrowIcon && (
								<EyebrowIcon
									size={13}
									fill="currentColor"
									strokeWidth={0}
									absoluteStrokeWidth
								/>
							)}
							{eyebrow.label}
						</div>
						<h1 className={styles.title}>{media.title}</h1>
						<div className={styles.meta_row}>
							<MediaReleaseDate date={media.releaseDate} />
							{review.rating != null && (
								<div className={styles.rating}>
									{review.rating}
									<StarIcon size={13} />
								</div>
							)}
						</div>
					</div>
					<div className={styles.excerpt} ref={excerptRef}>
						<ReviewSpoilerProvider>
							<ReviewBody
								text={review.body!}
								paragraphClassName={styles.excerpt_line}
								maxBlocks={EXCERPT_MAX_BLOCKS}
								spoilersInteractive={false}
							/>
						</ReviewSpoilerProvider>
					</div>
					{isOverflowing && (
						<span className={styles.read_more}>Read full review →</span>
					)}
				</div>
			</div>
		</Link>
	);
}
