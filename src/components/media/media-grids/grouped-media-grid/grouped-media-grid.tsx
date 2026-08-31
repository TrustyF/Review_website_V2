import { ReactNode } from "react";
import { MediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./grouped-media-grid.module.sass";

export type MediaGroup = {
	// Stable across re-renders; doubles as LazyMediaGrid's restoreKey so each group's scroll-reveal depth is independent.
	key: string;
	label: ReactNode;
	items: MediaRecord[];
};

type Props = {
	groups: MediaGroup[];
	// Forwarded to each group's own LazyMediaGrid.
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// Lays out pre-grouped media as collapsible, lazily-revealed grids, one per group; grouping/ordering is the caller's concern.
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
