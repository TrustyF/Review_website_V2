import { notFound } from "next/navigation";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
import { toMediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./genre-media-list-page.module.sass";

type Props = {
	name: string;
};

// Genre's own filtered catalog view, reached from the stats page's top-genres
// list. A name can span multiple MediaType "origin" rows, so match them all.
export async function GenreMediaListPage({ name }: Props) {
	const genres = await db.genre.findMany({ where: { name } });
	if (genres.length === 0) notFound();
	const genreIds = genres.map((g) => g.id);

	const [rawList, dict] = await Promise.all([
		dbPublic.media.findMany({
			where: {
				enrichmentStatus: EnrichmentStatus.DONE,
				mediaGenres: { some: { genreId: { in: genreIds } } },
			},
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

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>{name}</h1>
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
