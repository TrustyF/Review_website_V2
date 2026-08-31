import { CSSProperties } from "react";
import { MediaRecord } from "@/components/media/types";
import styles from "./featured-review-picker.module.sass";

type Props = {
	items: MediaRecord[];
	activeIndex: number;
	// Hides the countdown ring and stops it re-arming while auto-advance is paused.
	paused: boolean;
	// How long the countdown ring takes to fill, in ms — must match FeaturedReview's own AUTO_ADVANCE_MS.
	autoAdvanceMs: number;
	onSelect: (index: number) => void;
};

// Row of dots for the other recent reviews shown in FeaturedReview's hero. Clicking one swaps it into the hero; the dot one ahead of active carries a countdown ring to auto-advance.
export function FeaturedReviewPicker({
	items,
	activeIndex,
	paused,
	autoAdvanceMs,
	onSelect,
}: Props) {
	if (items.length <= 1) return null;

	// The dot auto-advance will land on next — its countdown ring should be filling now.
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
