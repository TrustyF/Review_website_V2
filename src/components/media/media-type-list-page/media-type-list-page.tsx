import { db } from "@/server/db/client";
import { MediaSearchGrid } from "@/components/media/media-search-grid/media-search-grid";
import { toSearchEntry } from "@/components/media/media-search-grid/build-search-entries";
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
			<h1>{title}</h1>
			<MediaSearchGrid entries={entries} />
		</div>
	);
}
