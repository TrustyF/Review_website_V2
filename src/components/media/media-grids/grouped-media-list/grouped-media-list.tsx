import { CSSProperties, Fragment } from "react";
import { MediaCardResolver } from "@/components/media/media-cards/media-card/media-card-resolver";
import { MediaGroup } from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";
import listStyles from "@/components/media/media-grids/lazy-media-list/lazy-media-list.module.sass";
import styles from "./grouped-media-list.module.sass";

type Props = {
	groups: MediaGroup[];
};

// No reveal-on-scroll of its own — the only caller already hands it only whatever's been fetched so far.
export function GroupedMediaList({ groups }: Props) {
	return (
		<div className={styles.groups}>
			{groups.map((group, groupIndex) => {
				const list = (
					<div className={listStyles.list}>
						{group.items.map((item, index) => (
							<div
								className={`${listStyles.item} ${styles.item}`}
								key={item.id}
								style={{ "--stagger-index": index } as CSSProperties}>
								<MediaCardResolver media={item} />
							</div>
						))}
					</div>
				);

				// First group ("this month") is self-evident, so it skips the label/details wrapper; only earlier groups get one.
				if (groupIndex === 0) {
					return <Fragment key={group.key}>{list}</Fragment>;
				}

				return (
					<details key={group.key} open>
						<summary className={styles.group_header}>{group.label}</summary>
						<hr className={styles.group_divider} />
						{list}
					</details>
				);
			})}
		</div>
	);
}
