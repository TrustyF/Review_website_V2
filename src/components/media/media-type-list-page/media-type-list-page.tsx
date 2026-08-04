import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { RatedTierGrid } from "@/components/media/rated-tier-grid/rated-tier-grid";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import styles from "./media-type-list-page.module.sass";

type Props = {
	title: string;
	type: MediaType;
	// The type-specific relation to load (e.g. { movie: true }) — review is
	// always included, every list page needs it for RatedTierGrid's tiers.
	include: Prisma.MediaInclude;
};

// Shared by every per-type page (movies, shorts, tv, manga, games, ...):
// fetch every DONE media row of one type, rate-tier them, done. Pages only
// differ in title/type/include, so they're thin callers of this.
export async function MediaTypeListPage({ title, type, include }: Props) {
	const rawList = await db.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, type },
		include: { ...include, review: true },
		// Without this, Postgres doesn't guarantee row order at all — it's
		// free to change between requests, and an UPDATE (e.g. saving a
		// poster) can shift a row's physical position enough to change it.
		// RatedTierGrid's sort-by-rating is a *stable* sort, so within a tier
		// it just preserves whatever order rows arrived in — pinning that
		// order here is what keeps ties from reshuffling on unrelated edits.
		orderBy: { id: "asc" },
	});
	const media = await Promise.all(rawList.map(toMediaRecord));

	return (
		<div className={styles.wrapper}>
			<h1>{title}</h1>
			<RatedTierGrid media={media} />
		</div>
	);
}
