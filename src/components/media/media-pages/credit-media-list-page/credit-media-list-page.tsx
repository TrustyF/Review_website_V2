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
import { hasPhotoEligibleRole } from "@/server/resolvers/person-photo-eligibility";
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

// Roles that reflect someone actually shaping a work's own vision, not just
// executing it or funding it — the avg-rating row below is scoped to these
// when a person has any, judged separately from every other credit they've
// had a smaller hand in (an acting or casting credit says much less about
// someone's own creative output than a directing or writing credit does).
// Producer/Executive Producer and pure-craft roles (Editor, Director of
// Photography, ...) are deliberately left out even though they're on
// NOTABLE_CREW_JOBS (credit-limits.ts) — notable enough to keep in the DB,
// but not "authored this" the way these are. Covers every source's own
// authorial role name, not just TMDB's (MangaDex/ComicVine use
// Author/Artist, IGDB uses Developer), same reasoning as
// search-actions.ts's ROLE_LABEL_PRIORITY.
const CREATIVE_ROLES = new Set([
	"Director",
	"Writer",
	"Screenplay",
	"Story",
	"Creator",
	"Author",
	"Artist",
	"Developer",
]);

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

// Self-weighted mean (Σr³ / Σr²) rather than a plain mean, ignoring media
// with no value for the field in question (unrated, or no public rating
// scraped yet) rather than treating a missing rating as a 0 that would drag
// the average down. Weighting each rating by its own square means a 9 pulls
// the result up more than a 5 pulls it down — a higher score is taken as a
// stronger, more meaningful signal than a middling one, rather than every
// credited title counting for the same one point regardless of how good or
// mediocre it was. WEIGHT_POWER=3 chosen over the milder 2 after comparing
// both against real credited-rating data — 3 pulled consistently higher
// without swinging wildly for anyone in that sample. Falls back to a plain
// mean when every value is 0 (Σr² would otherwise be 0, making Σr³/Σr²
// divide by zero) — there's no meaningful "weight toward the higher score"
// among a set of all-zero ratings anyway.
const WEIGHT_POWER = 3;

function weightedRating(values: number[]): number | null {
	if (values.length === 0) return null;
	const weightSum = values.reduce((sum, v) => sum + v ** (WEIGHT_POWER - 1), 0);
	if (weightSum === 0) return 0;
	const poweredSum = values.reduce((sum, v) => sum + v ** WEIGHT_POWER, 0);
	return poweredSum / weightSum;
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

	// Every role this entity has a DONE, non-deleted credit under. Actor is
	// sorted first (it gets the avg-rating row below) and the rest follow
	// alphabetically. Computed before photoSrc below since it also decides
	// that.
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

	// Only Person carries a photoPath (see Credit.character's neighboring
	// comment on Person.photoPath in the schema) — the "in" check also
	// narrows entity's type for the toPersonPhotoSrc call below. Gated by
	// role like everywhere else a person's photo might show (see
	// person-photo-eligibility.ts) — landing on this specific person's own
	// page isn't itself treated as reason enough to download a photo for a
	// role that isn't otherwise eligible.
	const photoSrc =
		"photoPath" in entity && hasPhotoEligibleRole(roleNames)
			? toPersonPhotoSrc(entity.id, entity.photoPath)
			: null;

	const roleGroups = await Promise.all(
		roleNames.map(async (name) => ({
			name,
			media: await loadRoleMedia(kind, id, name),
		})),
	);

	// Average of this person's own ratings and of the media's public rating.
	// Scoped to just their creative-role credits when they have any, deduped
	// so a title credited under more than one of those roles (e.g. a writer-
	// director) isn't counted twice. Everyone else (pure actors, producers,
	// studios, ...) falls back to every title they're credited on regardless
	// of role, same as before this scoping existed.
	const creativeMedia = [
		...new Map(
			roleGroups
				.filter((group) => CREATIVE_ROLES.has(group.name))
				.flatMap((group) => group.media.map((item) => [item.id, item])),
		).values(),
	];
	const ratedMedia =
		creativeMedia.length > 0
			? creativeMedia
			: [
					...new Map(
						roleGroups.flatMap((group) =>
							group.media.map((item) => [item.id, item]),
						),
					).values(),
				];
	const avgPersonalRating = weightedRating(
		ratedMedia
			.map((item) => item.review?.rating)
			.filter((rating): rating is number => rating != null),
	);
	const avgPublicRating = weightedRating(
		ratedMedia
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
	// Most-credited role group first — a more useful default than the
	// Actor-first/alphabetical order roleNames was built in above (which only
	// exists to decide *query* order, not display order).
	const mergedGroups = [...groupByMediaKey.values()].sort(
		(a, b) => b.media.length - a.media.length,
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
					{(avgPersonalRating != null || avgPublicRating != null) && (
						<div className={styles.role_rating_row}>
							{avgPersonalRating != null && (
								<span className={styles.role_rating}>
									<StarIcon size={13} />
									<span className={styles.role_rating_number}>
										{avgPersonalRating.toFixed(1)}
									</span>{" "}
									<span>avg</span>
								</span>
							)}
							{avgPublicRating != null && (
								<span className={styles.role_rating}>
									<StarIcon size={13} style={{ color: "var(--link)" }} />
									<span className={styles.role_rating_number}>
										{avgPublicRating.toFixed(1)}
									</span>{" "}
									<span>public avg</span>
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
