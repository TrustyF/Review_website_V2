import { CSSProperties } from "react";
import { MediaRecord } from "@/components/media/types";
import styles from "./featured-review-picker.module.sass";

type Props = {
	items: MediaRecord[];
	activeIndex: number;
	// Hides the countdown ring and stops it re-arming — see FeaturedReview's
	// own `paused` state for why (auto-advance pauses on interaction).
	paused: boolean;
	// How long the countdown ring takes to fill, in ms — must match
	// FeaturedReview's own AUTO_ADVANCE_MS, the interval its auto-advance
	// timer actually runs on.
	autoAdvanceMs: number;
	onSelect: (index: number) => void;
};

// Row of dots standing in for the other recent reviews shown in
// FeaturedReview's hero — replaces the old prev/next arrows (and, before
// that, a strip of poster thumbnails). Clicking one swaps that review into
// the hero; the dot one ahead of the active one carries a countdown ring
// showing how long until auto-advance moves on to it.
export function FeaturedReviewPicker({
	items,
	activeIndex,
	paused,
	autoAdvanceMs,
	onSelect,
}: Props) {
	if (items.length <= 1) return null;

	// The dot auto-advance will land on next, i.e. the one whose countdown
	// ring should be filling right now.
	const nextIndex = (activeIndex + 1) % items.length;

	return (
		<div className={styles.picker}>
			{items.map((item, i) => (
				<div
					key={item.id}
					className={`${styles.picker_item} ${i === activeIndex ? styles.picker_item_active : ""}`}>
					<button
						type="button"
						className={styles.picker_dot}
						aria-current={i === activeIndex ? "true" : undefined}
						aria-label={`Show featured review: ${item.title}`}
						onClick={() => onSelect(i)}
					/>
				</div>
			))}
		</div>
	);
}
