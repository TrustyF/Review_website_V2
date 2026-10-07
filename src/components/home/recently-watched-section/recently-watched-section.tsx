import { BadgeCheck } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import sectionStyles from "@/components/home/home-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

export async function RecentlyWatchedSection({ items }: Props) {
	if (items.length === 0) return null;
	const dict = await getDictionary();

	return (
		<section className={sectionStyles.wrapper}>
			<HomeSectionHeader
				icon={BadgeCheck}
				title={dict.home.recentlyWatched}
				subtitle={dict.home.subtitles.recentlyWatched}
			/>
			<MediaCardDisplayProvider showTitle={false} fade={false}>
				<OneRowMediaGrid items={items} rows={2} />
			</MediaCardDisplayProvider>
		</section>
	);
}
