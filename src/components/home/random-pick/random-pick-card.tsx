"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Link } from "@/components/ui/link";
import { MediaRecord } from "@/components/media/types";
import { MediaPoster } from "@/components/media/primitives/poster";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	ReviewBody,
	ReviewSpoilerProvider,
} from "@/components/media/media-cards/media-card/review-body";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import { SpinButton } from "@/components/home/spin-button/spin-button";
import { useDictionary, useLocale } from "@/lib/i18n/i18n-context";
import { fetchRandomPicks } from "./random-pick-actions";
import sectionStyles from "@/components/home/home-section.module.sass";
import styles from "./random-pick-card.module.sass";

function RandomPickItem({ media }: { media: MediaRecord }) {
	const dict = useDictionary();
	const locale = useLocale();
	// Re-measured on every resize, same as FeaturedReviewCardMobile — a reflow can flip whether the excerpt clips.
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
	// Falls back to English when untranslated, like MediaTitle/MediaReviewBody.
	const title = locale === "fr" ? (media.titleFr ?? media.title) : media.title;
	const body =
		locale === "fr"
			? (media.review?.bodyFr ?? media.review?.body)
			: media.review?.body;

	return (
		<div className={styles.item}>
			<div className={styles.poster}>
				<MediaPoster
					src={media.posterSrc}
					title={media.title}
					mediaId={media.id}
				/>
			</div>
			<div className={styles.info}>
				<Link href={`/media/${media.id}`} className={styles.title}>
					{title}
				</Link>
				<div className={styles.meta_row}>
					<MediaReleaseDate date={media.releaseDate} />
					{media.review?.rating != null && (
						<span className={styles.rating}>
							{media.review.rating}
							<StarIcon size={13} />
						</span>
					)}
				</div>
				{body && (
					<div
						ref={excerptRef}
						className={`${styles.excerpt} ${isOverflowing ? styles.excerpt_clipped : ""}`}>
						<ReviewSpoilerProvider>
							<ReviewBody
								text={body}
								paragraphClassName={styles.excerpt_line}
								spoilersInteractive={false}
							/>
						</ReviewSpoilerProvider>
					</div>
				)}
				{/* visibility (not unmounting) keeps its row, so hiding it can't free room that un-clips the excerpt. */}
				<Link
					href={`/media/${media.id}`}
					className={`${styles.read_more} ${!isOverflowing ? styles.read_more_hidden : ""}`}
					aria-hidden={!isOverflowing || undefined}
					tabIndex={isOverflowing ? undefined : -1}>
					{dict.home.readFullReview}
				</Link>
			</div>
		</div>
	);
}

type Props = {
	initial: MediaRecord[];
};

export function RandomPickCard({ initial }: Props) {
	const dict = useDictionary();
	const [picks, setPicks] = useState(initial);
	const [isPending, startTransition] = useTransition();
	function spin() {
		startTransition(async () => {
			const next = await fetchRandomPicks(picks.map((m) => m.id));
			if (next.length > 0) setPicks(next);
		});
	}

	return (
		<section className={sectionStyles.wrapper}>
			<HomeSectionHeader
				title={dict.home.randomPick}
				action={<SpinButton onSpin={spin} pending={isPending} />}
			/>
			<div
				className={`${sectionStyles.body} ${styles.grid} ${isPending ? styles.pending : ""}`}>
				{picks.map((media) => (
					<RandomPickItem key={media.id} media={media} />
				))}
			</div>
		</section>
	);
}
