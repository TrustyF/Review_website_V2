import Link from "next/link";
import { dbPublic } from "@/server/db/client";
import { MediaFilterGrid } from "@/components/media/media-grids/media-filter-grid/media-filter-grid";
import { toMediaRecord } from "@/components/media/types";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import styles from "./media-type-list-page.module.sass";

type Props = {
	title: string;
	type: MediaType;
	// The type-specific relation to load (e.g. { movie: true }) — review is
	// always included, every list page needs it for RatedTierGrid's tiers.
	include: Prisma.MediaInclude;
	// Link to this type's flat, recency-sorted sibling (see
	// RecentMediaListPage) — omitted for types that don't have one yet.
	recentHref?: string;
};

// Shared by every per-type page (movies, shorts, tv, manga, games, ...):
// fetch every DONE media row of one type, rate-tier them, done. Pages only
// differ in title/type/include, so they're thin callers of this.
export async function MediaTypeListPage({
	title,
	type,
	include,
	recentHref,
}: Props) {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts.
	const rawList = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, type },
		include: {
			...include,
			review: true,
			// For MediaFilterPopover's genre filter (see media-filter-grid.tsx).
			mediaGenres: { include: { genre: true } },
		},
		// Without this, Postgres doesn't guarantee row order at all — it's
		// free to change between requests, and an UPDATE (e.g. saving a
		// poster) can shift a row's physical position enough to change it.
		// RatedTierGrid's sort-by-rating is a *stable* sort, so within a tier
		// it just preserves whatever order rows arrived in — pinning that
		// order here is what keeps ties from reshuffling on unrelated edits.
		orderBy: { id: "asc" },
	});
	const media = rawList.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			{recentHref && (
				<Link href={recentHref} className={styles.recent_link}>
					Recent
				</Link>
			)}
			<MediaFilterGrid media={media} showRating={false} showTitle={false} />
		</div>
	);
}
