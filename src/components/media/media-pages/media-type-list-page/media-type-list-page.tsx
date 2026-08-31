import { Link } from "@/components/ui/link";
import { dbPublic } from "@/server/db/client";
import { MediaFilterGrid } from "@/components/media/media-grids/media-filter-grid/media-filter-grid";
import { toMediaRecord } from "@/components/media/types";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import styles from "./media-type-list-page.module.sass";

type Props = {
	title: string;
	type: MediaType;
	// The type-specific relation to load (e.g. { movie: true }); review is always included for RatedTierGrid's tiers.
	include: Prisma.MediaInclude;
	// Link to this type's flat, recency-sorted sibling (RecentMediaListPage) — omitted for types that don't have one yet.
	recentHref?: string;
};

// Shared by every per-type page: fetch every DONE media row of one type, rate-tier them. Pages only differ in title/type/include.
export async function MediaTypeListPage({
	title,
	type,
	include,
	recentHref,
}: Props) {
	// dbPublic (not db) — soft-deleted media is excluded automatically.
	const rawList = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, type },
		include: {
			...include,
			review: true,
			// For MediaFilterPopover's genre filter.
			mediaGenres: { include: { genre: true } },
		},
		// Without this, Postgres row order can shift between requests (e.g. an UPDATE moving a row). RatedTierGrid's stable sort-by-rating preserves arrival order within a tier, so pinning it here keeps ties from reshuffling.
		orderBy: { id: "asc" },
	});
	const media = rawList.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<MediaFilterGrid media={media} showRating={false} showTitle={false} />
		</div>
	);
}
