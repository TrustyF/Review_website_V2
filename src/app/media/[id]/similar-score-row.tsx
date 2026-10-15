"use client";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import type { SimilarItem, SimilarScore } from "./similar-media";
import styles from "./similar-score-row.module.sass";

const CATEGORIES: [keyof SimilarScore, string][] = [
	["genre", "genre"],
	["keywords", "keywords"],
	["people", "people"],
	["language", "language"],
	["country", "country"],
	["era", "era"],
	["rating", "× rating"],
	["difficulty", "× diff"],
	["total", "total"],
];

// Dev-only: the similar row plus each card's per-category ranking points over its poster.
export function SimilarScoreRow({ items }: { items: SimilarItem[] }) {
	const scores = new Map(items.map((i) => [i.media.id, i.score]));
	return (
		<OneRowMediaGrid
			items={items.map((i) => i.media)}
			renderOverlay={(item) => {
				const score = scores.get(item.id);
				if (!score) return null;
				return (
					<div className={styles.anchor}>
						<dl className={styles.scores}>
							{CATEGORIES.map(([key, label]) => (
								<div
									key={key}
									className={`${styles.row} ${key === "total" ? styles.total : ""} ${score[key] === 0 ? styles.zero : ""}`}>
									<dt>{label}</dt>
									<dd>{score[key].toFixed(2)}</dd>
								</div>
							))}
						</dl>
					</div>
				);
			}}
		/>
	);
}
