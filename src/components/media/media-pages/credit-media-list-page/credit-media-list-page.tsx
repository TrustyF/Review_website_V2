import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import {
	MediaRecord,
	RawMediaRecord,
	toMediaRecord,
} from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { MediaGridColumnsProvider } from "@/components/media/media-grids/lazy-media-grid/media-grid-columns-context";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { StarIcon } from "@/components/media/icons/star-icon";
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

// Flips the query's own ordering between release date and rating — still a
// flat, ungrouped LazyMediaGrid either way, just sorted differently at the
// source. A code-level switch, not a per-visitor control, so it's just a
// constant rather than anything threaded through props or context.
const SORT_MODE: "RATED" | "UNSORTED" = "RATED";

// Queries every DONE, non-deleted media row this entity is credited on,
// optionally narrowed to one role name, deduped to one card per media and
// sorted per SORT_MODE. Shared by the primary (possibly role-scoped) grid
// and each "also credited as" role's own grid below.
async function loadRoleMedia(
	kind: "person" | "company",
	id: number,
	role: string | undefined,
): Promise<MediaRecord[]> {
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
		// Unrated media (or media with no Review row at all) sorts last rather
		// than first — same "missing value loses" convention RatedTierGrid uses
		// for its own "Unrated" tier.
		orderBy:
			SORT_MODE === "RATED"
				? { media: { review: { rating: { sort: "desc", nulls: "last" } } } }
				: { media: { releaseDate: "desc" } },
	});

	// The same person/company can be credited more than once on one title
	// under the *same* role (e.g. actor + character listed twice) — dedupe to
	// one card per media. Different roles are never merged here, so the same
	// title can (deliberately) still show up once per role's own grid below.
	// orderBy above already sorted the underlying credits, and Map preserves
	// insertion order, so this stays in that order too.
	const byMediaId = new Map<number, RawMediaRecord>();
	for (const credit of credits) {
		if (!byMediaId.has(credit.media.id))
			byMediaId.set(credit.media.id, credit.media);
	}

	return [...byMediaId.values()].map(toMediaRecord);
}

// Plain arithmetic mean, ignoring media with no value for the field in
// question (unrated, or no public rating scraped yet) rather than treating
// a missing rating as a 0 that would drag the average down.
function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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
	const photoSrc =
		"photoPath" in entity
			? toPersonPhotoSrc(entity.id, entity.photoPath)
			: null;

	const media = await loadRoleMedia(kind, id, role);

	// Only meaningful for the Actor role specifically (an entity's other
	// roles get their own grid, not this stat row) — average of this
	// person's own ratings and of the media's public rating, across every
	// title in the Starring-in grid above.
	const avgPersonalRating =
		role === "Actor"
			? average(
					media
						.map((item) => item.review?.rating)
						.filter((rating): rating is number => rating != null),
				)
			: null;
	const avgPublicRating =
		role === "Actor"
			? average(
					media
						.map((item) => item.publicRating)
						.filter((rating): rating is number => rating != null),
				)
			: null;

	// Other roles this entity is credited under (Director, Writer, Studio,
	// ...), so filtering to one role (e.g. Actor, via the media detail page's
	// "by <director>"/cast links) doesn't strand the visitor there — each one
	// gets its own grid below the primary role's, same media re-fetched under
	// that role rather than reused, so a title credited under two roles
	// legitimately shows up in both. Only worth the query when a role filter
	// is actually active; unfiltered, every role's media is already mixed
	// into the one grid above.
	const otherRoleNames = role
		? [
				...new Set(
					(
						await db.credit.findMany({
							where: {
								...(kind === "person" ? { personId: id } : { companyId: id }),
								role: { name: { not: role } },
								media: {
									enrichmentStatus: EnrichmentStatus.DONE,
									isDeleted: false,
								},
							},
							select: { role: { select: { name: true } } },
							distinct: ["roleId"],
						})
					).map((credit) => credit.role.name),
				),
			].sort((a, b) => a.localeCompare(b))
		: [];

	const otherRoleGroups = await Promise.all(
		otherRoleNames.map(async (name) => ({
			name,
			media: await loadRoleMedia(kind, id, name),
		})),
	);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				{(photoSrc || kind === "person") && (
					<PersonPhoto
						src={photoSrc}
						alt={entity.name}
						photoClassName={styles.photo}
						placeholderClassName={styles.photo_placeholder}
						iconSize={32}
					/>
				)}
				<div className={styles.header_text}>
					<span className={styles.entity_name}>{entity.name}</span>
					{role === "Actor" &&
						(avgPersonalRating != null || avgPublicRating != null) && (
							<div className={styles.role_rating_row}>
								{avgPersonalRating != null && (
									<span className={styles.role_rating}>
										<StarIcon size={13} />
										{avgPersonalRating.toFixed(1)} avg
									</span>
								)}
								{avgPublicRating != null && (
									<span className={styles.role_rating}>
										<StarIcon size={13} style={{ color: "var(--link)" }} />
										{avgPublicRating.toFixed(1)} public avg
									</span>
								)}
							</div>
						)}
				</div>
			</div>
			<div className={role ? styles.other_role_group : undefined}>
				{role && (
					<h2 className={styles.other_role_title}>
						{role === "Actor" ? "Starring in" : role}
					</h2>
				)}
				{media.length === 0 ? (
					<p className={styles.empty}>No credited media in the collection.</p>
				) : (
					<MediaGridColumnsProvider value={7}>
						<LazyMediaGrid items={media} />
					</MediaGridColumnsProvider>
				)}
			</div>
			{otherRoleGroups.map(
				(group) =>
					group.media.length > 0 && (
						<div className={styles.other_role_group} key={group.name}>
							<h2 className={styles.other_role_title}>{group.name}</h2>
							<MediaGridColumnsProvider value={7}>
								<LazyMediaGrid items={group.media} />
							</MediaGridColumnsProvider>
						</div>
					),
			)}
		</div>
	);
}
