"use client";
import { BookOpen, Flame, GamepadDirectional } from "lucide-react";
import { MediaType } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";
import { recentlyWatchedTitle } from "@/components/media/media-verb-labels";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { useDictionary } from "@/lib/i18n/i18n-context";
import sectionStyles from "@/components/home/home-section.module.sass";
import { RECENT_MEDIA_GROUPS, RecentMediaGroup } from "./recent-media-groups";

type Props = {
	group: RecentMediaGroup;
	recentReleases: { type: MediaType; items: MediaRecord[] }[];
	recentlyWatched: MediaRecord[];
};

// A group's per-type recent-releases rows, then one shared recently-read/played row. Data fetched when scrolled into view.
export function RecentMediaSections({
	group,
	recentReleases,
	recentlyWatched,
}: Props) {
	const dict = useDictionary();
	if (recentReleases.length === 0 && recentlyWatched.length === 0) return null;

	// Every type in a group shares the same verb, so the first one titles the shared row.
	const groupType = RECENT_MEDIA_GROUPS[group][0];

	return (
		<MediaCardDisplayProvider showTitle={false} fade={false}>
			{recentReleases.map(({ type, items }) => (
				<section key={type} className={sectionStyles.wrapper}>
					<HomeSectionHeader
						icon={Flame}
						title={dict.home.recentReleases}
						subtitle={dict.home.subtitles.recentReleases}
					/>
					<OneRowMediaGrid items={items} />
				</section>
			))}
			{recentlyWatched.length > 0 && (
				<section className={sectionStyles.wrapper}>
					<HomeSectionHeader
						icon={group === "GAME" ? GamepadDirectional : BookOpen}
						title={recentlyWatchedTitle(groupType, dict)}
						subtitle={
							group === "GAME"
								? dict.home.subtitles.recentlyPlayed
								: dict.home.subtitles.recentlyRead
						}
					/>
					<OneRowMediaGrid items={recentlyWatched} />
				</section>
			)}
		</MediaCardDisplayProvider>
	);
}
