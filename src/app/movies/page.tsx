import { db } from "@/server/db/client";
import { MediaRecord, toMediaRecord } from "@/components/media/media-card/types";
import { MediaMiniCardResolver } from "@/components/media/media-card/cards-mini/media-mini-card-resolver";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import styles from "./movies.module.sass";

// Buckets movies into whole-point rating tiers (9 covers a 9.0-9.5 rating,
// etc.) — halfway steps would mean twenty collapsible sections, too many to
// be useful as a grid overview. Unrated movies get their own tier at the end
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

export default async function MoviesPage() {
	const rawList = await db.media.findMany({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			type: { in: [MediaType.MOVIE, MediaType.SHORT] },
		},
		include: { movie: true, review: true },
	});
	const movies = await Promise.all(rawList.map(toMediaRecord));
	movies.sort((a, b) => (b.review?.rating ?? -1) - (a.review?.rating ?? -1));

	// Group into rating tiers, highest first (Unrated last).
	const tiers = new Map<number | null, MediaRecord[]>();
	for (const media of movies) {
		const tier = ratingTierOf(media);
		const bucket = tiers.get(tier);
		if (bucket) bucket.push(media);
		else tiers.set(tier, [media]);
	}
	const orderedTiers = [...tiers.entries()].sort(([a], [b]) => {
		if (a === null) return 1;
		if (b === null) return -1;
		return b - a;
	});

	return (
		<div className={styles.wrapper}>
			<h1>Movies</h1>
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
						<div className={styles.tier_grid}>
							{items.map((media) => (
								<MediaMiniCardResolver
									media={media}
									key={media.id}
								/>
							))}
						</div>
					</details>
				))}
			</div>
		</div>
	);
}
