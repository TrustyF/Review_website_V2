import { Link } from "@/components/ui/link";
import { dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import styles from "./recent-media-list-page.module.sass";

type Props = {
	title: string;
	type: MediaType;
	// The type-specific relation to load (e.g. { movie: true }); toMediaRecord throws without it.
	include: Prisma.MediaInclude;
	// Where this page's per-type list lives, so "By rating" can link back to it.
	backHref: string;
};

// Sibling to MediaTypeListPage: same query, but flat and sorted by releaseDate instead of rating — for browsing what's new rather than what's best.
export async function RecentMediaListPage({
	title,
	type,
	include,
	backHref,
}: Props) {
	// dbPublic (not db) — soft-deleted media is excluded automatically.
	const rawList = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, type },
		// mediaGenres isn't used on this page, but is included so TypeScript infers it with the nested genre shape RawMediaRecord requires.
		include: {
			...include,
			review: true,
			mediaGenres: { include: { genre: true } },
		},
		orderBy: { releaseDate: "desc" },
	});
	const mediaList = rawList.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>{title}</h1>
				<Link href={backHref} className={styles.back_link}>
					By rating
				</Link>
			</div>
			<LazyMediaGrid items={mediaList} />
		</div>
	);
}
