"use client";
import { CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { MediaMiniCardShell } from "@/components/media/media-cards/media-mini-card/media-mini-card-shell";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBodyLine,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import styles from "./featured-review.module.sass";

// Must match $card-transition-duration in featured-review.module.sass (the
// outgoing card's fade-out duration, not the faster incoming-only
// $card-enter-opacity-duration) — JS can't read a sass variable at runtime,
// so this is a separate constant kept in step with it by hand.
const CARD_TRANSITION_MS = 250;

// How long each auto-advanced review stays on screen before the hero moves
// to the next one. Stops for good the moment the user interacts with the
// picker (see `stoppedAutoAdvance` below) — this is a "welcome mat" for
// people who land on the page and don't touch anything, not a persistent
// slideshow that fights a reader who's already engaging with it.
const AUTO_ADVANCE_MS = 10000;

type Props = {
	// Ordered most-recently-reviewed first (see app/page.tsx's query) — the
	// hero starts on items[0]; the picker strip below lets you reveal any of
	// the rest in the hero itself instead of a separate mini-card grid.
	items: MediaRecord[];
};

// The homepage's hero, plus a filmstrip of the other recent reviews below it
// — clicking one swaps it into the hero rather than linking away, folding
// what used to be a separate "Recent reviews" grid into this component. Not
// a MediaCardShell variant: this wants the banner as a full-width backdrop
// and only a teaser of the review body (first few paragraphs), both of
// which the grid-oriented cards don't do.
export function FeaturedReview({ items }: Props) {
	const [index, setIndex] = useState(0);
	// Which way the picker selection last moved — determines which side the
	// next card slides in from (see FeaturedReviewCard). Purely cosmetic, so
	// a simple before/after comparison is enough; it doesn't need to account
	// for wraparound the way the old arrow-stepping version did.
	const [direction, setDirection] = useState<1 | -1>(1);
	// The card being replaced, kept mounted just long enough to play its own
	// exit transition — without this the old card would simply vanish the
	// instant the new one's key swapped in, popping off instead of fading
	// out alongside the incoming card. Cleared once the exit transition's
	// duration has elapsed (see the timeout effect below, kept in step with
	// featured-review.module.sass's transition duration).
	const [outgoing, setOutgoing] = useState<
		(MediaRecord & { review: NonNullable<MediaRecord["review"]> }) | null
	>(null);
	// Once the picker's been clicked, auto-advance stops permanently for the
	// rest of this page view — a reader who's already steering shouldn't have
	// the hero change out from under them a few seconds later.
	const [stoppedAutoAdvance, setStoppedAutoAdvance] = useState(false);

	useEffect(() => {
		if (!outgoing) return;
		const timeout = setTimeout(() => setOutgoing(null), CARD_TRANSITION_MS);
		return () => clearTimeout(timeout);
	}, [outgoing]);

	// Guards against a media row somehow reaching this component without a
	// reviewed body — shouldn't happen given the page's own query filter, but
	// keeps this safe to reuse without trusting every future caller to
	// replicate that filter exactly, same defensive shape as MediaReview's
	// own `if (!review) return null`.
	const reviewed = items.filter(
		(m): m is MediaRecord & { review: NonNullable<MediaRecord["review"]> } =>
			!!m.review?.body,
	);

	// Kept current every render via their own effect (refs can't be written
	// during render itself) — the interval below is only ever set up once
	// (per stoppedAutoAdvance) and reads through these refs at fire time to
	// get whatever index/list is current then, rather than closing over the
	// values from whenever the interval itself was created.
	const indexRef = useRef(index);
	const reviewedRef = useRef(reviewed);
	useEffect(() => {
		indexRef.current = index;
		reviewedRef.current = reviewed;
	});

	useEffect(() => {
		if (stoppedAutoAdvance || reviewedRef.current.length <= 1) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const interval = setInterval(() => {
			const list = reviewedRef.current;
			const currentIndex = indexRef.current;
			const nextIndex = (currentIndex + 1) % list.length;
			setDirection(1);
			setOutgoing(list[currentIndex]!);
			setIndex(nextIndex);
		}, AUTO_ADVANCE_MS);
		return () => clearInterval(interval);
	}, [stoppedAutoAdvance]);

	if (reviewed.length === 0) return null;

	const media = reviewed[index]!;

	function select(nextIndex: number) {
		setStoppedAutoAdvance(true);
		if (nextIndex === index) return;
		setDirection(nextIndex > index ? 1 : -1);
		setOutgoing(media);
		setIndex(nextIndex);
	}

	return (
		<div className={styles.wrapper}>
			{/* Stacked via .card_stack's grid-area trick so the outgoing and
			    incoming cards overlap during the crossfade instead of the
			    incoming one appearing below/after the outgoing one leaves. The
			    outgoing card keeps the *same* key it had a render ago (plain
			    outgoing.id, not e.g. "exit-<id>") — it's the same
			    FeaturedReviewCard that was just the current hero, so this key
			    match is what tells React to update it in place (exiting flips
			    to true) instead of unmounting and remounting it. A remount here
			    would reset its nested MediaPoster's loaded state and restart
			    its own fade-in right as the card starts fading out — a poster
			    that was fully visible flashing invisible then back in. The
			    incoming card genuinely is a new mount (a different item keyed
			    by its own media.id), which is what runs its entrance
			    animation. */}
			<div className={styles.card_stack}>
				{outgoing && (
					<FeaturedReviewCard
						key={outgoing.id}
						media={outgoing}
						direction={direction}
						exiting
					/>
				)}
				<FeaturedReviewCard
					key={media.id}
					media={media}
					direction={direction}
				/>
			</div>

			{reviewed.length > 1 && (
				<div className={styles.picker}>
					{/* Title off — this strip is a row of small posters, not a
					    labeled grid, and the title would just wrap/truncate at
					    4.5rem wide anyway. Review icon off too — every item here
					    already has a review by construction (see `reviewed`
					    above), so it'd just be dead weight on every single one. */}
					<MediaCardDisplayProvider
						showTitle={false}
						showReviewIcon={false}
						showRating={false}>
						{reviewed.map((item, i) => (
							<div
								key={item.id}
								className={`${styles.picker_item} ${i === index ? styles.picker_item_active : ""}`}>
								{/* MediaMiniCardShell already renders exactly what this
								    strip wants (poster + rating), but its poster is a Link
								    to the media page — this strip wants a click to swap
								    the item into the hero in place, not navigate away. inert
								    turns the whole shell into inanimate visuals: it drops
								    out of the tab order and stops accepting pointer events
								    (both the poster Link and the admin-only edit button),
								    so the overlay button below is the only actually
								    interactive/focusable element here. */}
								<div inert className={styles.picker_item_inert}>
									<MediaMiniCardShell media={item} />
								</div>
								<button
									type="button"
									className={styles.picker_item_overlay}
									aria-current={i === index ? "true" : undefined}
									aria-label={`Show featured review: ${item.title}`}
									onClick={() => select(i)}
								/>
							</div>
						))}
					</MediaCardDisplayProvider>
				</div>
			)}
		</div>
	);
}

type CardProps = {
	media: MediaRecord & { review: NonNullable<MediaRecord["review"]> };
	direction: 1 | -1;
	exiting?: boolean;
};

function FeaturedReviewCard({ media, direction, exiting = false }: CardProps) {
	// Entering cards start offset/transparent and flip to .settled a frame
	// after mount. Exiting cards run the same toggle backwards: they start
	// already .settled (they were the visible hero a moment ago) and flip
	// back to the unsettled, offset/transparent state, which is what
	// actually plays the fade-and-slide-out instead of the card just
	// disappearing when FeaturedReview drops it from the tree. Either way,
	// two renders with a real paint in between are what let the browser
	// actually animate the transition instead of jumping straight to the
	// resting position (a plain synchronous setState inside the effect can
	// get coalesced into the same paint as the initial render, skipping the
	// transition entirely).
	const [settled, setSettled] = useState(exiting);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setSettled(!exiting));
		return () => cancelAnimationFrame(frame);
	}, [exiting]);

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

	// Only the incoming card slides; the outgoing one just fades in place
	// (offset 0), so the two don't read as sliding past each other.
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
					<div className={styles.eyebrow}>Featured review</div>
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
