"use client";
import { MediaType } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";
import { recentlyWatchedTitle } from "@/components/media/media-verb-labels";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./recent-media-sections.module.sass";

type Props = {
	type: MediaType;
	recentReleases: MediaRecord[];
	recentlyWatched: MediaRecord[];
};

// Recent-releases + recently-watched pair for one media type. Data fetched when scrolled into view. Same fixed-size deferred-reveal grid as movie sections, parameterized by type.
export function RecentMediaSections({
	type,
	recentReleases,
	recentlyWatched,
}: Props) {
	const dict = useDictionary();
	if (recentReleases.length === 0 && recentlyWatched.length === 0) return null;

	const releasesTitle =
		type === MediaType.GAME ? dict.home.recentGames : dict.home.recentReleases;

	return (
		<MediaCardDisplayProvider showTitle={false}>
			{recentReleases.length > 0 && (
				<section className={styles.wrapper}>
					<h2 className={styles.title}>{releasesTitle}</h2>
					<OneRowMediaGrid items={recentReleases} />
				</section>
			)}
			{recentlyWatched.length > 0 && (
				<section className={styles.wrapper}>
					<h2 className={styles.title}>{recentlyWatchedTitle(type, dict)}</h2>
					<OneRowMediaGrid items={recentlyWatched} />
				</section>
			)}
		</MediaCardDisplayProvider>
	);
}
