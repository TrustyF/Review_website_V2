import { Clapperboard } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import sectionStyles from "@/components/home/home-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

export async function RecentMoviesSection({ items }: Props) {
	if (items.length === 0) return null;
	const dict = await getDictionary();

	return (
		<section className={sectionStyles.wrapper}>
			<HomeSectionHeader
				icon={Clapperboard}
				title={dict.home.recentReleases}
				subtitle={dict.home.subtitles.recentReleases}
			/>
			<MediaCardDisplayProvider showTitle={false} fade={false}>
				<OneRowMediaGrid items={items} />
			</MediaCardDisplayProvider>
		</section>
	);
}
