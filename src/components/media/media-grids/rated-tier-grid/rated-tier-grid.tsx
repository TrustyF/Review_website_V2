import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./rated-tier-grid.module.sass";

// Buckets media into whole-point rating tiers (9 covers a 9.0-9.5 rating,
// etc.) — halfway steps would mean twenty collapsible sections, too many to
// be useful as a grid overview. Unrated media get their own tier at the end
// rather than being silently dropped.
function ratingTierOf(media: MediaRecord): number | null {
	const rating = media.review?.rating;
	if (rating == null) return null;
	return Math.floor(rating);
}

function tierLabel(tier: number | null): string {
	if (tier === null) return "Unrated";
	if (tier >= 10) return "10";
	return `${tier}–${tier + 1}`;
}

type Props = {
	media: MediaRecord[];
};

// Groups media into rating tiers, highest first (Unrated last), each
// rendered as a collapsible, lazily-revealed grid of mini cards.
export function RatedTierGrid({ media }: Props) {
	const sorted = [...media].sort(
		(a, b) => (b.review?.rating ?? -1) - (a.review?.rating ?? -1),
	);

	const tiers = new Map<number | null, MediaRecord[]>();
	for (const item of sorted) {
		const tier = ratingTierOf(item);
		const bucket = tiers.get(tier);
		if (bucket) bucket.push(item);
		else tiers.set(tier, [item]);
	}
	const orderedTiers = [...tiers.entries()].sort(([a], [b]) => {
		if (a === null) return 1;
		if (b === null) return -1;
		return b - a;
	});

	return (
		<div className={styles.tiers}>
			{orderedTiers.map(([tier, items]) => (
				<details
					className={styles.tier}
					key={tier ?? "unrated"}
					open
				>
					<summary className={styles.tier_header}>
						{tierLabel(tier)}
						<span className={styles.tier_count}>{items.length}</span>
					</summary>
					<LazyMediaGrid
						items={items}
						restoreKey={tier === null ? "unrated" : String(tier)}
					/>
				</details>
			))}
		</div>
	);
}
