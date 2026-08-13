"use client";
import { CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
	// Ordered most-recently-reviewed first (see app/page.tsx's query) — the
	// hero starts on items[0] and the arrows step through the rest without
	// leaving the homepage.
	items: MediaRecord[];
};

// The homepage's hero. Not a MediaCardShell variant: this wants the banner
// as a full-width backdrop and only a teaser of the review body (first few
// paragraphs), both of which the grid-oriented cards don't do.
export function FeaturedReview({ items }: Props) {
	const [index, setIndex] = useState(0);
	// Which way the arrows last moved — determines which side the next card
	// slides in from (see FeaturedReviewCard).
	const [direction, setDirection] = useState<1 | -1>(1);

	// Guards against a media row somehow reaching this component without a
	// reviewed body — shouldn't happen given the page's own query filter, but
	// keeps this safe to reuse without trusting every future caller to
	// replicate that filter exactly, same defensive shape as MediaReview's
	// own `if (!review) return null`.
	const reviewed = items.filter(
		(m): m is MediaRecord & { review: NonNullable<MediaRecord["review"]> } =>
			!!m.review?.body,
	);
	if (reviewed.length === 0) return null;

	const media = reviewed[index % reviewed.length]!;

	function step(delta: 1 | -1) {
		setDirection(delta);
		setIndex((i) => (i + delta + reviewed.length) % reviewed.length);
	}

	return (
		<div className={styles.wrapper}>
			{/* Keyed by media.id so switching items remounts this instead of
			    patching the existing one in place — FeaturedReviewCard's own
			    entrance animation runs on mount, so a fresh mount per item is
			    what actually re-triggers it every time the arrows are used. */}
			<FeaturedReviewCard key={media.id} media={media} direction={direction} />

			{/* Siblings of the card's own <Link>, not nested inside it — a
			    <button> inside the <a> would need preventDefault/
			    stopPropagation on every click just to keep it from also
			    navigating; sitting outside sidesteps that entirely. */}
			{reviewed.length > 1 && (
				<>
					<button
						type="button"
						aria-label="Previous review"
						className={`${styles.arrow} ${styles.arrow_prev}`}
						onClick={() => step(-1)}>
						<ChevronLeft size={20} />
					</button>
					<button
						type="button"
						aria-label="Next review"
						className={`${styles.arrow} ${styles.arrow_next}`}
						onClick={() => step(1)}>
						<ChevronRight size={20} />
					</button>
				</>
			)}
		</div>
	);
}

type CardProps = {
	media: MediaRecord & { review: NonNullable<MediaRecord["review"]> };
	direction: 1 | -1;
};

function FeaturedReviewCard({ media, direction }: CardProps) {
	// Starts offset/transparent and flips to settled a frame after mount —
	// two renders with a real paint in between are what let the browser
	// actually animate the transition instead of jumping straight to the
	// resting position (a plain synchronous setState inside the effect can
	// get coalesced into the same paint as the initial render, skipping the
	// transition entirely).
	const [settled, setSettled] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setSettled(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	// "Read full review" is only useful (and only shown) when .excerpt is
	// actually clipping something — no way to know that without measuring
	// the rendered box, so it starts hidden and this flips it on once we can
	// tell there's more text than the max-height fits. Runs once per mount,
	// same as the settle effect above (this card remounts fresh per item —
	// see FeaturedReview's key={media.id}).
	const excerptRef = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	useEffect(() => {
		const el = excerptRef.current;
		if (el) setIsOverflowing(el.scrollHeight > el.clientHeight);
	}, []);

	const review = media.review;
	// Teaser only — the full body is one click away on the media page itself.
	// A few paragraphs rather than just the first, capped visually by
	// .excerpt's own line-clamp for anything longer.
	const paragraphs = review.body!.split("\n\n").slice(0, 3);

	return (
		<Link
			href={`/media/${media.id}`}
			className={`${styles.card_link} ${settled ? styles.settled : ""}`}
			style={{ "--enter-offset": `${direction * 2}rem` } as CSSProperties}>
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
						// Skips lazy-loading — true for the initial SSR'd hero (it's
						// the page's LCP candidate) and just as true for a card an
						// arrow click swaps in afterward: the user asked for it
						// right now, not whenever it happens to scroll into view.
						priority
					/>
					<div className={styles.banner_backdrop} />
				</div>
			)}
			<div
				className={`${styles.content} ${media.bannerSrc ? styles.content_overlap : ""}`}>
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
					<div className={styles.excerpt} ref={excerptRef}>
						<ReviewSpoilerProvider>
							{paragraphs.map((paragraph, i) => (
								<p className={styles.excerpt_line} key={i}>
									<ReviewBodyLine text={paragraph} />
								</p>
							))}
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
