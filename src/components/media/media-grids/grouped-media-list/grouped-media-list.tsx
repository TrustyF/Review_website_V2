import { MediaGroup } from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";
import { LazyMediaList } from "@/components/media/media-grids/lazy-media-list/lazy-media-list";
import styles from "./grouped-media-list.module.sass";

type Props = {
	groups: MediaGroup[];
};

// GroupedMediaGrid's sibling for LazyMediaList — same collapsible-stack-of-
// groups shape (see that component's own note on why grouping itself is
// entirely the caller's concern), just handing each group's items to the
// full-card list instead of the mini-card grid. Reuses GroupedMediaGrid's
// MediaGroup type rather than redefining an identical shape.
export function GroupedMediaList({ groups }: Props) {
	return (
		<div className={styles.groups}>
			{groups.map((group) => (
				<details key={group.key} open>
					<summary className={styles.group_header}>{group.label}</summary>
					<LazyMediaList items={group.items} restoreKey={group.key} />
				</details>
			))}
		</div>
	);
}
