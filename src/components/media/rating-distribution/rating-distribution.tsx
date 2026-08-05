import { MediaRecord } from "@/components/media/media-card/types";
import styles from "./rating-distribution.module.sass";

// Same whole-point bucketing as RatedTierGrid (0–1 … 9–10, unrated last) —
// keeps this chart's bars reading as "the same tiers you'd scroll through
// below" rather than an unrelated binning.
const TIER_COUNT = 10;

function tierOf(rating: number | null): number | null {
	if (rating == null) return null;
	return Math.min(Math.floor(rating), TIER_COUNT - 1);
}

function tierLabel(tier: number): string {
	return `${tier}–${tier + 1}`;
}

type Props = {
	media: MediaRecord[];
};

// Small histogram of how a person/company's credited media rated, bucketed
// into the same whole-point tiers RatedTierGrid groups the list into below.
// One series (counts) — a single flat hue, no legend needed.
export function RatingDistribution({ media }: Props) {
	const counts = new Array<number>(TIER_COUNT).fill(0);
	let unrated = 0;
	for (const item of media) {
		const tier = tierOf(item.review?.rating ?? null);
		if (tier === null) unrated++;
		else counts[tier] = (counts[tier] ?? 0) + 1;
	}
	const max = Math.max(...counts, unrated, 1);

	return (
		<div className={styles.wrapper}>
			<h2 className={styles.title}>Rating distribution</h2>
			<div className={styles.chart}>
				{counts.map((count, tier) => (
					<div
						className={styles.column}
						key={tier}
					>
						<div
							className={styles.bar_track}
							tabIndex={count > 0 ? 0 : undefined}
							aria-label={`${count} ${count === 1 ? "title" : "titles"} rated ${tierLabel(tier)}`}
						>
							<div
								className={styles.bar}
								style={{ height: `${(count / max) * 100}%` }}
							/>
							{count > 0 && (
								<span
									className={styles.tooltip}
									aria-hidden
								>
									{count} rated {tierLabel(tier)}
								</span>
							)}
						</div>
						<span className={styles.tick}>{tier}</span>
					</div>
				))}
				<div className={styles.column}>
					<div
						className={styles.bar_track}
						tabIndex={unrated > 0 ? 0 : undefined}
						aria-label={`${unrated} ${unrated === 1 ? "title" : "titles"} unrated`}
					>
						<div
							className={`${styles.bar} ${styles.bar_unrated}`}
							style={{ height: `${(unrated / max) * 100}%` }}
						/>
						{unrated > 0 && (
							<span
								className={styles.tooltip}
								aria-hidden
							>
								{unrated} unrated
							</span>
						)}
					</div>
					<span className={styles.tick}>—</span>
				</div>
			</div>
		</div>
	);
}
