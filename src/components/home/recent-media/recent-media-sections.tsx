import { MediaType } from "@prisma/client";
import { MediaRecord } from "@/components/media/types";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import styles from "./recent-media-sections.module.sass";

// "Watched"'s verb depends on the media's type — mirrors WATCHED_LABEL_BY_TYPE in change-log-list.tsx.
const WATCHED_TITLE_BY_TYPE: Partial<Record<MediaType, string>> = {
	[MediaType.BOOK]: "Recently read",
	[MediaType.COMIC]: "Recently read",
	[MediaType.MANGA]: "Recently read",
	[MediaType.GAME]: "Recently played",
};

const RELEASES_TITLE_BY_TYPE: Partial<Record<MediaType, string>> = {
	[MediaType.GAME]: "Recent games",
};

type Props = {
	type: MediaType;
	recentReleases: MediaRecord[];
	recentlyWatched: MediaRecord[];
};

// Recent-releases + recently-watched pair for one media type, presentational — data is fetched
// by LazyRecentMediaSection once this pair scrolls into view. Same fixed-size, deferred-reveal
// grid as the movie home sections (LazyMediaGrid), just parameterized by type.
export function RecentMediaSections({
	type,
	recentReleases,
	recentlyWatched,
}: Props) {
	if (recentReleases.length === 0 && recentlyWatched.length === 0) return null;

	return (
		<MediaCardDisplayProvider showTitle={false}>
			{recentReleases.length > 0 && (
				<section className={styles.wrapper}>
					<h2 className={styles.title}>
						{RELEASES_TITLE_BY_TYPE[type] ?? "Recent releases"}
					</h2>
					<LazyMediaGrid
						items={recentReleases}
						restoreKey={`home-recent-${type.toLowerCase()}`}
					/>
				</section>
			)}
			{recentlyWatched.length > 0 && (
				<section className={styles.wrapper}>
					<h2 className={styles.title}>
						{WATCHED_TITLE_BY_TYPE[type] ?? "Recently watched"}
					</h2>
					<LazyMediaGrid
						items={recentlyWatched}
						restoreKey={`home-recently-watched-${type.toLowerCase()}`}
					/>
				</section>
			)}
		</MediaCardDisplayProvider>
	);
}
