import { Popcorn } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import sectionStyles from "@/components/home/home-section.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	items: MediaRecord[];
};

export async function AnticipatedReleasesSection({ items }: Props) {
	if (items.length === 0) return null;
	const dict = await getDictionary();

	return (
		<section className={sectionStyles.wrapper}>
			<HomeSectionHeader
				icon={Popcorn}
				title={dict.home.anticipatedReleases}
				subtitle={dict.home.subtitles.anticipatedReleases}
			/>
			<MediaCardDisplayProvider showTitle={false} showReleaseDate fade={false}>
				<OneRowMediaGrid items={items} />
			</MediaCardDisplayProvider>
		</section>
	);
}
