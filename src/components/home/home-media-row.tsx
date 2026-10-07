import { ReactNode } from "react";
import type { MediaCardRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { HomeSectionHeader } from "./home-section-header";
import styles from "./home-section.module.sass";

type Props = {
	title: ReactNode;
	// Already trimmed via toMediaCardRecord — kept type-only so client sections can render this too.
	items: MediaCardRecord[];
	seeAll?: { href: string; label: string };
	action?: ReactNode;
	// Rendered between the header and the grid (e.g. a person spotlight's intro).
	intro?: ReactNode;
	pending?: boolean;
};

// Header + single poster row, the shape most home sections share.
export function HomeMediaRow({
	title,
	items,
	seeAll,
	action,
	intro,
	pending = false,
}: Props) {
	if (items.length === 0) return null;
	return (
		<section className={`${styles.wrapper} ${pending ? styles.pending : ""}`}>
			<HomeSectionHeader
				title={title}
				action={action}
				{...(seeAll ? { seeAll } : {})}
			/>
			{intro}
			<MediaCardDisplayProvider showTitle={false} fade={false}>
				<OneRowMediaGrid items={items} />
			</MediaCardDisplayProvider>
		</section>
	);
}
