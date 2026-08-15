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
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	kind: "person" | "company";
	id: number;
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

// "Director, Producer and Screenplay" — Oxford-less list join for merged
// role group titles.
function joinNames(names: string[]): string {
	if (names.length <= 1) return names.join("");
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Shared by both /credits/person/[id] and /credits/company/[id]: look up the
// credited entity and render one titled grid per role they're credited
// under (Actor, Director, Writer, Studio, ...) — no query param needed, this
// always shows every credit type the entity has.
export async function CreditMediaListPage({ kind, id }: Props) {
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

	// Every role this entity has a DONE, non-deleted credit under. Actor is
	// sorted first (it gets the avg-rating row below) and the rest follow
	// alphabetically.
	const roleNames = [
		...new Set(
			(
				await db.credit.findMany({
					where: {
						...(kind === "person" ? { personId: id } : { companyId: id }),
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
	].sort((a, b) => {
		if (a === "Actor") return -1;
		if (b === "Actor") return 1;
		return a.localeCompare(b);
	});

	const roleGroups = await Promise.all(
		roleNames.map(async (name) => ({
			name,
			media: await loadRoleMedia(kind, id, name),
		})),
	);

	// Average of this person's own ratings and of the media's public rating,
	// across every title they're credited on regardless of role — a title
	// credited under more than one role (e.g. writer-director) is deduped so
	// it isn't counted twice.
	const allMedia = [
		...new Map(
			roleGroups.flatMap((group) => group.media.map((item) => [item.id, item])),
		).values(),
	];
	const avgPersonalRating = average(
		allMedia
			.map((item) => item.review?.rating)
			.filter((rating): rating is number => rating != null),
	);
	const avgPublicRating = average(
		allMedia
			.map((item) => item.publicRating)
			.filter((rating): rating is number => rating != null),
	);

	// Roles credited on the exact same set of titles (e.g. a writer-director
	// whose directing and writing credits line up 1:1) share one grid instead
	// of two identical-looking ones back to back. Order of first appearance
	// is preserved, so Actor (sorted first above) still leads its merged
	// title when it's part of one.
	const groupByMediaKey = new Map<
		string,
		{ names: string[]; media: MediaRecord[] }
	>();
	for (const group of roleGroups) {
		if (group.media.length === 0) continue;
		const mediaKey = group.media
			.map((item) => item.id)
			.sort((a, b) => a - b)
			.join(",");
		const existingGroup = groupByMediaKey.get(mediaKey);
		if (existingGroup) {
			existingGroup.names.push(group.name);
		} else {
			groupByMediaKey.set(mediaKey, {
				names: [group.name],
				media: group.media,
			});
		}
	}
	const mergedGroups = [...groupByMediaKey.values()];

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
					{(avgPersonalRating != null || avgPublicRating != null) && (
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
			{roleGroups.length === 0 ? (
				<p className={styles.empty}>No credited media in the collection.</p>
			) : (
				mergedGroups.map((group) => (
					<div className={styles.other_role_group} key={group.names.join(",")}>
						<h2 className={styles.other_role_title}>
							{group.names.length === 1 && group.names[0] === "Actor"
								? "Starring in"
								: joinNames(group.names)}
						</h2>
						<MediaGridColumnsProvider value={7}>
							<MediaCardDisplayProvider showTitle={false}>
								<LazyMediaGrid items={group.media} />
							</MediaCardDisplayProvider>
						</MediaGridColumnsProvider>
					</div>
				))
			)}
		</div>
	);
}
