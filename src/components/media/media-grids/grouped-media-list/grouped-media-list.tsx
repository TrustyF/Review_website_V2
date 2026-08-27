import { CSSProperties } from "react";
import { MediaCardResolver } from "@/components/media/media-cards/media-card/media-card-resolver";
import { MediaGroup } from "@/components/media/media-grids/grouped-media-grid/grouped-media-grid";
import listStyles from "@/components/media/media-grids/lazy-media-list/lazy-media-list.module.sass";
import styles from "./grouped-media-list.module.sass";

type Props = {
	groups: MediaGroup[];
};

// Renders every group's every item directly, no reveal-on-scroll of its
// own — AllReviewsFeed (this component's only caller) already only ever
// hands it however many reviews have actually been fetched from the server
// so far (see all-reviews-actions.ts's loadMoreReviews), so there's nothing
// left here to hide.
export function GroupedMediaList({ groups }: Props) {
	return (
		<div className={styles.groups}>
			{groups.map((group) => (
				<details key={group.key} open>
					<summary className={styles.group_header}>{group.label}</summary>
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
				</details>
			))}
		</div>
	);
}
