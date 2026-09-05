"use client";
import { ReactNode } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import styles from "./one-row-media-grid.module.sass";

type Props = {
	items: MediaRecord[];
	// How many fixed rows to fill before hiding the rest. Capped in the sass file at $max-rows.
	rows?: number;
	renderOverlay?: ((item: MediaRecord) => ReactNode) | undefined;
};

// Always exactly `rows` rows: container-query breakpoints generated in the sass file size columns
// to fill the available width and hide whichever trailing items don't fit, instead of wrapping.
export function OneRowMediaGrid({ items, rows = 1, renderOverlay }: Props) {
	return (
		<div className={styles.wrapper} data-rows={rows}>
			<div className={styles.grid}>
				{items.map((item) => (
					<div className={styles.item} key={item.id}>
						<MediaMiniCardResolver media={item} />
						{renderOverlay?.(item)}
					</div>
				))}
			</div>
		</div>
	);
}
