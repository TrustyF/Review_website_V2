import { OneRowMediaGrid } from "@/components/media/media-grids/one-row-media-grid/one-row-media-grid";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSimilarMedia } from "./similar-media";
import { SimilarScoreRow } from "./similar-score-row";
import styles from "./media-detail.module.sass";

// Hidden entirely (heading included) when nothing clears the relevance bar.
export async function MediaSimilarSection({ mediaId }: { mediaId: number }) {
	const [items, dict] = await Promise.all([
		getSimilarMedia(mediaId),
		getDictionary(),
	]);
	if (items.length === 0) return null;
	return (
		<section className={styles.section}>
			<h2 className={styles.section_title}>
				{dict.mediaDetail.similarHeading}
			</h2>
			<MediaCardDisplayProvider
				fade={false}
				showRating={false}
				showTitle={false}>
				{process.env.NODE_ENV === "development" ? (
					<SimilarScoreRow items={items} />
				) : (
					<OneRowMediaGrid items={items.map((i) => i.media)} />
				)}
			</MediaCardDisplayProvider>
		</section>
	);
}
