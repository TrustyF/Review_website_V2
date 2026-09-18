import { notFound } from "next/navigation";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
import { toMediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { WORLD_MAP_COUNTRIES } from "@/components/stats/world-map/world-map-paths.generated";
import { countryFlagEmoji } from "@/lib/country-flag";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./country-media-list-page.module.sass";

export const COUNTRY_NAME_BY_CODE = new Map(
	WORLD_MAP_COUNTRIES.map((c) => [c.code, c.name]),
);

type Props = {
	code: string;
};

// Country of origin's own filtered catalog view — reached by clicking a
// country on the stats page's world map, or its top-countries list.
export async function CountryMediaListPage({ code }: Props) {
	const country = await db.country.findUnique({
		where: { countryCode2: code.toUpperCase() },
	});
	if (!country) notFound();

	const [rawList, dict] = await Promise.all([
		dbPublic.media.findMany({
			where: { enrichmentStatus: EnrichmentStatus.DONE, countryId: country.id },
			include: {
				movie: true,
				tvShow: true,
				manga: true,
				comic: true,
				game: true,
				book: true,
				review: true,
				mediaGenres: { include: { genre: true } },
			},
			orderBy: { id: "asc" },
		}),
		getDictionary(),
	]);
	const media = rawList.map(toMediaRecord);
	const name =
		COUNTRY_NAME_BY_CODE.get(country.countryCode2) ?? country.countryCode2;

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<span className={styles.flag}>
						{countryFlagEmoji(country.countryCode2)}
					</span>
					{name}
				</h1>
				<span className={styles.count}>
					{dict.stats.titleCount(media.length)}
				</span>
			</div>
			{media.length === 0 ? (
				<p className={styles.empty}>{dict.lists.emptyMedia}</p>
			) : (
				<MediaCardDisplayProvider showTitle={false} showRating={false}>
					<LazyMediaGrid items={media} />
				</MediaCardDisplayProvider>
			)}
		</div>
	);
}
