"use client";
import { CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/components/ui/link";
import { Settings } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBody,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useFeaturedManagerStore } from "@/components/home/featured-review/featured-manager/featured-manager-store";
import { FeaturedReviewCardMobile } from "./featured-review-card-mobile";
import { FeaturedReviewPicker } from "./featured-review-picker";
import { eyebrowFor } from "./featured-review-shared";
import styles from "./featured-review.module.sass";

// Must match $card-transition-duration (outgoing fade-out, not the faster $card-enter-opacity-duration) — JS can't read a sass variable at runtime.
const CARD_TRANSITION_MS = 350;

// How long each review stays on screen before auto-advancing; also reused as the idle delay before auto-advance resumes after picker interaction.
const AUTO_ADVANCE_MS = 15000;

type Props = {
	// items[0] is always the most-recently-reviewed item, pinned regardless of shuffle; the rest is a daily-seeded shuffle of the remaining pool (see getFeaturedReviewItems).
	items: MediaRecord[];
};

// The homepage's hero, plus a filmstrip of other recent reviews below it — clicking one swaps it into the hero instead of linking away. Not a MediaCardShell variant: this wants a full-width banner backdrop and a body teaser, which the grid-oriented cards don't do.
export function FeaturedReview({ items }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (same rule as nav-admin-links.tsx).
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const openFeaturedManager = useFeaturedManagerStore((s) => s.open);
	const [index, setIndex] = useState(0);
	// Which way the picker selection last moved, so the next card slides in from the right side.
	const [direction, setDirection] = useState<1 | -1>(1);
	// The card being replaced, kept mounted to play its exit transition instead of popping off. Cleared once the exit duration elapses (see timeout effect below).
	const [outgoing, setOutgoing] = useState<
		(MediaRecord & { review: NonNullable<MediaRecord["review"]> }) | null
	>(null);
	// True while steering via the picker — auto-advance pauses on interaction and resumes after AUTO_ADVANCE_MS of no further interaction.
	const [paused, setPaused] = useState(false);
	// Bumped on every picker interaction, including a re-click on the active item where index alone wouldn't change — keys the resume-timer effect below.
	const [interactionTick, setInteractionTick] = useState(0);

	useEffect(() => {
		if (!outgoing) return;
		const timeout = setTimeout(() => setOutgoing(null), CARD_TRANSITION_MS);
		return () => clearTimeout(timeout);
	}, [outgoing]);

	// Guards against a media row reaching this without a reviewed body — shouldn't happen given the page query, but keeps this safe for future callers.
	const reviewed = items.filter(
		(m): m is MediaRecord & { review: NonNullable<MediaRecord["review"]> } =>
			!!m.review?.body,
	);

	// Kept current via their own effect (refs can't be written during render) — the interval below reads these at fire time instead of closing over stale values.
	const indexRef = useRef(index);
	const reviewedRef = useRef(reviewed);
	useEffect(() => {
		indexRef.current = index;
		reviewedRef.current = reviewed;
	});

	useEffect(() => {
		if (paused || reviewedRef.current.length <= 1) return;
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
	}, [paused]);

	// Un-pauses AUTO_ADVANCE_MS after the most recent picker interaction, re-armed on every select() call so active browsing never gets interrupted.
	useEffect(() => {
		if (!paused) return;
		const timeout = setTimeout(() => setPaused(false), AUTO_ADVANCE_MS);
		return () => clearTimeout(timeout);
	}, [paused, interactionTick]);

	if (reviewed.length === 0) return null;

	const media = reviewed[index]!;

	function select(nextIndex: number) {
		setPaused(true);
		setInteractionTick((t) => t + 1);
		if (nextIndex === index) return;
		setDirection(nextIndex > index ? 1 : -1);
		setOutgoing(media);
		setIndex(nextIndex);
	}

	return (
		<div className={styles.wrapper}>
			{/* Stacked via .card_stack's grid-area trick so outgoing/incoming crossfade in place. The outgoing card keeps the same key (plain outgoing.id) so React updates it in place (exiting flips to true) instead of remounting — a remount would reset its MediaPoster's loaded state and flash it invisible. */}
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
				{/* Swapped in for the cards above via CSS below $mobile-breakpoint. Same outgoing/incoming pair and keys, so crossfade/settle timing matches the desktop pair. */}
				{outgoing && (
					<FeaturedReviewCardMobile
						key={`${outgoing.id}-mobile`}
						media={outgoing}
						direction={direction}
						exiting
					/>
				)}
				<FeaturedReviewCardMobile
					key={`${media.id}-mobile`}
					media={media}
					direction={direction}
				/>
			</div>

			{/* Manages the global featured set, not the item currently in the hero — a sibling of .card_stack, not inside the card's own <Link>, so it never fights that navigation. */}
			{isAdmin && (
				<button
					type="button"
					className={styles.manage_featured_button}
					aria-label="Manage featured reviews"
					onClick={openFeaturedManager}>
					<Settings size={16} />
				</button>
			)}

			{/* Auto-advance pauses on interaction, so the countdown ring here only shows while it's actually running. */}
			<FeaturedReviewPicker
				items={reviewed}
				activeIndex={index}
				paused={paused}
				autoAdvanceMs={AUTO_ADVANCE_MS}
				onSelect={select}
			/>
		</div>
	);
}

type CardProps = {
	media: MediaRecord & { review: NonNullable<MediaRecord["review"]> };
	direction: 1 | -1;
	exiting?: boolean;
};

function FeaturedReviewCard({ media, direction, exiting = false }: CardProps) {
	// Entering cards start offset/transparent, flip to .settled a frame after mount. Exiting cards run this backwards (start settled, then flip off) to play the fade-and-slide-out. requestAnimationFrame ensures a real paint happens between the two states, or the transition gets coalesced away.
	const [settled, setSettled] = useState(exiting);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setSettled(!exiting));
		return () => cancelAnimationFrame(frame);
	}, [exiting]);

	// "Read full review" only shows when .excerpt actually clips — measured via ResizeObserver since there's no way to know that without rendering it.
	const excerptRef = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	useEffect(() => {
		const el = excerptRef.current;
		if (!el) return;
		const observer = new ResizeObserver(() => {
			setIsOverflowing(el.scrollHeight > el.clientHeight);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const review = media.review;
	const eyebrow = eyebrowFor(review);
	const EyebrowIcon = eyebrow.icon;

	// Only the incoming card slides; outgoing just fades in place, so they don't read as sliding past each other.
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
						// Skips lazy-loading — the initial hero is the page's LCP candidate, and a swapped-in card is wanted immediately too.
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
						// Fixed regardless of media type (unlike the grid cards) — the poster's width is fixed here too, so a varying ratio would change the card's height and shove the picker below it as items rotate.
						ratio="2/3"
					/>
				</div>
				<div className={styles.info}>
					<div className={styles.eyebrow}>
						{EyebrowIcon && (
							<EyebrowIcon
								size={14}
								fill="currentColor"
								// absoluteStrokeWidth keeps stroke weight exact regardless of size, avoiding the blur a non-integer size/24 scale caused for the navbar's icons.
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
								<StarIcon size={14} />
							</div>
						)}
					</div>
					<div className={styles.excerpt} ref={excerptRef}>
						<ReviewSpoilerProvider>
							<ReviewBody
								text={review.body!}
								paragraphClassName={styles.excerpt_line}
								// The whole card is already a Link — a spoiler's click-to-reveal would fight that navigation, so clicks fall through untouched.
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
