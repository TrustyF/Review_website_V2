import { ReactNode } from "react";
import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./grouped-media-grid.module.sass";

export type MediaGroup = {
	// Stable across re-renders (a rating tier number, a year, "unrated") —
	// used as both the <details> key and LazyMediaGrid's own restoreKey, so
	// each group keeps its own scroll-reveal depth independent of the others.
	key: string;
	label: ReactNode;
	items: MediaRecord[];
};

type Props = {
	groups: MediaGroup[];
	// Forwarded straight through to each group's own LazyMediaGrid — see
	// that component's own note on why this exists.
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// Renders any pre-grouped media (rating tiers, release/watch years, ...) as
// a stack of collapsible, lazily-revealed grids — one per group, highest/
// newest first. The actual grouping (what counts as a group, how they're
// ordered) is entirely the caller's concern; this only knows how to lay out
// groups it's handed. RatedTierGrid is the original, still-default view
// (bucketed by rating); MediaFilterGrid's release-date/watch-date sorts
// bucket by year through the same component instead of each rolling their
// own collapsible-list markup.
export function GroupedMediaGrid({ groups, renderOverlay }: Props) {
	return (
		<div className={styles.groups}>
			{groups.map((group) => (
				<details key={group.key} open>
					<summary className={styles.group_header}>{group.label}</summary>
					<LazyMediaGrid
						items={group.items}
						restoreKey={group.key}
						renderOverlay={renderOverlay}
					/>
				</details>
			))}
		</div>
	);
}
