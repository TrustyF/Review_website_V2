import Link from "next/link";
import { dbPublic } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import styles from "./recent-media-list-page.module.sass";

type Props = {
	title: string;
	type: MediaType;
	// The type-specific relation to load (e.g. { movie: true }) — same
	// requirement as MediaTypeListPage's include, toMediaRecord throws
	// without it.
	include: Prisma.MediaInclude;
	// Where this page's own per-type list lives, so "By rating" can link
	// straight back to it.
	backHref: string;
};

// Sibling to MediaTypeListPage: same DONE-only, one-type query, but flat
// (no RatedTierGrid tiers) and sorted by releaseDate instead of rating —
// for browsing what's new rather than what's best. No MediaSearchGrid here
// either: search's own grouping-by-match-field doesn't have a "recency"
// angle worth keeping, and LazyMediaGrid alone is exactly the flat grid
// this needs.
export async function RecentMediaListPage({
	title,
	type,
	include,
	backHref,
}: Props) {
	// dbPublic (not db) — soft-deleted media is excluded automatically, see
	// src/server/db/client.ts.
	const rawList = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, type },
		include: { ...include, review: true },
		orderBy: { releaseDate: "desc" },
	});
	const mediaList = rawList.map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1>{title}</h1>
				<Link
					href={backHref}
					className={styles.back_link}>
					By rating
				</Link>
			</div>
			<LazyMediaGrid items={mediaList} />
		</div>
	);
}
