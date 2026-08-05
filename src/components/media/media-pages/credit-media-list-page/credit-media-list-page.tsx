import Link from "next/link";
import { notFound } from "next/navigation";
import { Company, Credit, Person } from "@prisma/client";
import { db } from "@/server/db/client";
import { RawMediaRecord } from "@/components/media/types";
import { MediaSearchGrid } from "@/components/media/media-grids/media-search-grid/media-search-grid";
import { toSearchEntry } from "@/components/media/media-grids/media-search-grid/build-search-entries";
import { RatingDistribution } from "@/components/media/media-grids/rating-distribution/rating-distribution";
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

type MediaWithSearchCredits = Omit<RawMediaRecord, "credits"> & {
	credits: (Credit & { person: Person | null; company: Company | null })[];
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

	const credits = await db.credit.findMany({
		where: {
			...(kind === "person" ? { personId: id } : { companyId: id }),
			...(role ? { role: { name: role } } : {}),
			media: { enrichmentStatus: EnrichmentStatus.DONE },
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
					// Director/Studio only — enough for the search bar's relevance
					// ranking (see build-search-entries.ts).
					credits: {
						where: { role: { name: { in: ["Director", "Studio"] } } },
						include: { person: true, company: true },
					},
				},
			},
		},
		orderBy: { media: { id: "asc" } },
	});

	// The same person/company can be credited more than once on one title
	// (e.g. actor + character listed twice, or a studio with two credit
	// rows) — dedupe to one card per media.
	const byMediaId = new Map<number, MediaWithSearchCredits>();
	for (const credit of credits) {
		if (!byMediaId.has(credit.media.id)) byMediaId.set(credit.media.id, credit.media);
	}

	const entries = [...byMediaId.values()].map(toSearchEntry);
	const media = entries.map((entry) => entry.media);

	return (
		<div className={styles.wrapper}>
			<h1>{entity.name}</h1>
			{role && (
				<div className={styles.role_filter}>
					{role}
					<Link
						href={`/credits/${kind}/${id}`}
						className={styles.role_clear}
					>
						View all credits
					</Link>
				</div>
			)}
			{media.length === 0 ? (
				<p className={styles.empty}>No credited media in the collection.</p>
			) : (
				<>
					<RatingDistribution media={media} />
					<MediaSearchGrid entries={entries} />
				</>
			)}
		</div>
	);
}
