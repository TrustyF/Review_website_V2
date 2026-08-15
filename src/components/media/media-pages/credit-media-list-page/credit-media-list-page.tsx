import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { RawMediaRecord, toMediaRecord } from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { EnrichmentStatus } from "@prisma/client";
import { toPersonPhotoSrc } from "@/server/resolvers/poster-resolver";
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

	// Only Person carries a photoPath (see Credit.character's neighboring
	// comment on Person.photoPath in the schema) — the "in" check also
	// narrows entity's type for the toPersonPhotoSrc call below.
	const photoSrc = "photoPath" in entity ? toPersonPhotoSrc(entity.id, entity.photoPath) : null;

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
					book: true,
					review: true,
				},
			},
		},
		orderBy: { media: { releaseDate: "desc" } },
	});

	// The same person/company can be credited more than once on one title
	// (e.g. actor + character listed twice, or a studio with two credit
	// rows) — dedupe to one card per media. orderBy above already sorted the
	// underlying credits by release date, and Map preserves insertion order,
	// so this stays in that order too.
	const byMediaId = new Map<number, RawMediaRecord>();
	for (const credit of credits) {
		if (!byMediaId.has(credit.media.id))
			byMediaId.set(credit.media.id, credit.media);
	}

	const media = [...byMediaId.values()].map(toMediaRecord);

	return (
		<div className={styles.wrapper}>
			<div className={styles.content}>
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
					<LazyMediaGrid items={media} />
				)}
			</div>
			<div className={styles.sidebar}>
				{(photoSrc || kind === "person") && (
					<PersonPhoto
						src={photoSrc}
						alt={entity.name}
						photoClassName={styles.photo}
						placeholderClassName={styles.photo_placeholder}
						iconSize={48}
					/>
				)}
				<h1 className={styles.name}>{entity.name}</h1>
			</div>
		</div>
	);
}
