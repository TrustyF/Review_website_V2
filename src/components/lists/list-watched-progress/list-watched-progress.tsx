"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useWatched } from "@/components/watched/watched-context";
import styles from "./list-watched-progress.module.sass";

type Props = {
	mediaIds: number[];
	className?: string | undefined;
};

const ANIMATION_DURATION_MS = 600;

// Eases the displayed number/bar from its previous value to a new target (e.g. mount, or a
// live watched-toggle elsewhere on the page) instead of snapping — skipped for reduced-motion.
function useAnimatedPercent(target: number): number {
	const [displayed, setDisplayed] = useState(target);
	const previousRef = useRef(target);

	useEffect(() => {
		const from = previousRef.current;
		const to = target;
		previousRef.current = to;
		if (from === to) return;

		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reducedMotion) {
			const frame = requestAnimationFrame(() => setDisplayed(to));
			return () => cancelAnimationFrame(frame);
		}

		const start = performance.now();
		let frame: number;
		const tick = (now: number) => {
			const t = Math.min((now - start) / ANIMATION_DURATION_MS, 1);
			const eased = 1 - (1 - t) ** 3;
			setDisplayed(Math.round(from + (to - from) * eased));
			if (t < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [target]);

	return displayed;
}

// The viewer's own progress through this list (not the recipient's — that's the admin-only seenMediaIds badge on each item).
export function ListWatchedProgress({ mediaIds, className }: Props) {
	const { data: session } = useSession();
	const { isWatched } = useWatched();

	const watchedCount = mediaIds.filter((id) => isWatched(id)).length;
	const percent =
		mediaIds.length === 0
			? 0
			: Math.round((watchedCount / mediaIds.length) * 100);
	const displayedPercent = useAnimatedPercent(percent);

	if (!session?.user?.id || mediaIds.length === 0 || watchedCount === 0)
		return null;

	return (
		<div
			className={className ? `${styles.wrapper} ${className}` : styles.wrapper}>
			<div className={styles.top_row}>
				<div className={styles.text}>
					<span className={styles.label}>You&apos;ve watched</span>
					<span className={styles.count}>
						{watchedCount}/{mediaIds.length}
					</span>
				</div>
				<div className={styles.percent}>
					{displayedPercent}
					<span className={styles.percent_sign}>%</span>
				</div>
			</div>
			<div className={styles.bar_track}>
				<div
					className={styles.bar_fill}
					style={{ width: `${displayedPercent}%` }}
				/>
			</div>
		</div>
	);
}
