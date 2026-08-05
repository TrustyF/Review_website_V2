import Link from "next/link";
import { dbPublic } from "@/server/db/client";
import { MediaSearchGrid } from "@/components/media/media-grids/media-search-grid/media-search-grid";
import { toSearchEntry } from "@/components/media/media-grids/media-search-grid/build-search-entries";
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
			// Director/Studio only — enough for the search bar's relevance
			// ranking (see build-search-entries.ts), without pulling every
			// crew job for every item on a full list page.
			credits: {
				where: { role: { name: { in: ["Director", "Studio"] } } },
				include: { person: true, company: true },
			},
		},
		// Without this, Postgres doesn't guarantee row order at all — it's
		// free to change between requests, and an UPDATE (e.g. saving a
		// poster) can shift a row's physical position enough to change it.
		// RatedTierGrid's sort-by-rating is a *stable* sort, so within a tier
		// it just preserves whatever order rows arrived in — pinning that
		// order here is what keeps ties from reshuffling on unrelated edits.
		orderBy: { id: "asc" },
	});
	const entries = rawList.map(toSearchEntry);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>{title}</h1>
				{recentHref && (
					<Link
						href={recentHref}
						className={styles.recent_link}>
						Recent
					</Link>
				)}
			</div>
			<MediaSearchGrid entries={entries} />
		</div>
	);
}
