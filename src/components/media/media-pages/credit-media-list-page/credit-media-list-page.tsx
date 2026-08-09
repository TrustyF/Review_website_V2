import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { RawMediaRecord, toMediaRecord } from "@/components/media/types";
import { MediaFilterGrid } from "@/components/media/media-grids/media-filter-grid/media-filter-grid";
// RatingDistribution is currently disabled below — its import is dropped
// too so this doesn't trip an unused-import lint warning; re-add
// `import { RatingDistribution } from "@/components/media/media-grids/rating-distribution/rating-distribution";`
// alongside it if it comes back.
import { EnrichmentStatus } from "@prisma/client";
import styles from "./credit-media-list-page.module.sass";

type Props = {
	kind: "person" | "company";
	id: number;
	// Scopes the list to one role (e.g. "Director") — set whenever this page
	// is reached by clicking a credit under a specific role on the media
	// detail page, rather than browsing every credit this entity has.
	role?: string | undefined;
};

// Shared by both /credits/person/[id] and /credits/company/[id]: look up the
// credited entity, pull every DONE media row that credits them (optionally
// narrowed to one role), rate-tier them same as any other list page.
export async function CreditMediaListPage({ kind, id, role }: Props) {
	const entity =
		kind === "person"
			? await db.person.findUnique({ where: { id } })
			: await db.company.findUnique({ where: { id } });
	if (!entity) notFound();

	// Queried from Credit rather than Media, so dbPublic's auto-filter can't
	// reach it (Prisma extensions don't run for nested include/where — see
	// dbPublic's own comment in src/server/db/client.ts) — isDeleted: false
	// has to be spelled out here by hand instead.
	const credits = await db.credit.findMany({
		where: {
			...(kind === "person" ? { personId: id } : { companyId: id }),
			...(role ? { role: { name: role } } : {}),
			media: { enrichmentStatus: EnrichmentStatus.DONE, isDeleted: false },
		},
		include: {
			media: {
				include: {
					movie: true,
					tvShow: true,
					manga: true,
					comic: true,
					game: true,
					review: true,
					// For MediaFilterPopover's genre filter (see media-filter-grid.tsx).
					mediaGenres: { include: { genre: true } },
				},
			},
		},
		orderBy: { media: { id: "asc" } },
	});

	// The same person/company can be credited more than once on one title
	// (e.g. actor + character listed twice, or a studio with two credit
	// rows) — dedupe to one card per media.
	const byMediaId = new Map<number, RawMediaRecord>();
	for (const credit of credits) {
		if (!byMediaId.has(credit.media.id))
			byMediaId.set(credit.media.id, credit.media);
	}

	const media = [...byMediaId.values()].map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<h1>{entity.name}</h1>
			{role && (
				<div className={styles.role_filter}>
					{role}
					<Link href={`/credits/${kind}/${id}`} className={styles.role_clear}>
						View all credits
					</Link>
				</div>
			)}
			{media.length === 0 ? (
				<p className={styles.empty}>No credited media in the collection.</p>
			) : (
				<>
					{/*<RatingDistribution media={media} />*/}
					<MediaFilterGrid media={media} />
				</>
			)}
		</div>
	);
}
