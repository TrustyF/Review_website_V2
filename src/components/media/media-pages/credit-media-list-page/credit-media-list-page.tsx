import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import {
	MediaRecord,
	RawMediaRecord,
	toMediaRecord,
} from "@/components/media/types";
import { LazyMediaGrid } from "@/components/media/media-grids/lazy-media-grid/lazy-media-grid";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { StarIcon } from "@/components/media/icons/star-icon";
import { EnrichmentStatus } from "@prisma/client";
import { toPersonPhotoSrc } from "@/server/resolvers/asset-paths";
import { hasPhotoEligibleRole } from "@/server/resolvers/person-photo-eligibility";
import styles from "./credit-media-list-page.module.sass";
import { MediaCardDisplayProvider } from "@/components/media/media-card-display-context";

type Props = {
	kind: "person" | "company";
	id: number;
};

// Flips the query's ordering between release date and rating. A code-level switch, not a per-visitor control, so it's just a constant.
const SORT_MODE: "RATED" | "UNSORTED" = "RATED";

// Roles that reflect authoring a work's own vision, not just executing/funding it — the avg-rating row below is scoped to these when present. Producer and pure-craft roles are deliberately excluded despite being on NOTABLE_CREW_JOBS. Covers every source's own authorial role name (TMDB, MangaDex/ComicVine, IGDB).
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

// One query for every role at once, instead of an old one-per-role fan-out. Dedupes to one card per media within each role's group (a person/company can be credited twice on one title under the same role) — different roles are never merged here.
async function loadRoleMediaByRole(
	kind: "person" | "company",
	id: number,
): Promise<Map<string, MediaRecord[]>> {
	// Queried from Credit not Media, so dbPublic's auto-filter can't reach it (extensions don't run for nested include/where) — isDeleted: false spelled out by hand.
	const credits = await db.credit.findMany({
		where: {
			...(kind === "person" ? { personId: id } : { companyId: id }),
			media: { enrichmentStatus: EnrichmentStatus.DONE, isDeleted: false },
		},
		include: {
			role: { select: { name: true } },
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
		// Unrated media sorts last, not first — same convention as RatedTierGrid's "Unrated" tier.
		orderBy:
			SORT_MODE === "RATED"
				? { media: { review: { rating: { sort: "desc", nulls: "last" } } } }
				: { media: { releaseDate: "desc" } },
	});

	// orderBy already sorted the credits, and Map preserves insertion order, so dedupe/grouping stay in that order too.
	const byRole = new Map<string, Map<number, RawMediaRecord>>();
	for (const credit of credits) {
		let byMediaId = byRole.get(credit.role.name);
		if (!byMediaId) {
			byMediaId = new Map();
			byRole.set(credit.role.name, byMediaId);
		}
		if (!byMediaId.has(credit.media.id))
			byMediaId.set(credit.media.id, credit.media);
	}

	return new Map(
		[...byRole.entries()].map(([role, byMediaId]) => [
			role,
			[...byMediaId.values()].map(toMediaRecord),
		]),
	);
}

// Self-weighted mean (Σr³/Σr²), ignoring media with no value rather than treating it as a 0. A higher rating pulls the average up more than a lower one pulls it down. WEIGHT_POWER=3 chosen over 2 after comparing against real data. Falls back to a plain mean when every value is 0 (avoids divide-by-zero).
const WEIGHT_POWER = 3;

function weightedRating(values: number[]): number | null {
	if (values.length === 0) return null;
	const weightSum = values.reduce((sum, v) => sum + v ** (WEIGHT_POWER - 1), 0);
	if (weightSum === 0) return 0;
	const poweredSum = values.reduce((sum, v) => sum + v ** WEIGHT_POWER, 0);
	return poweredSum / weightSum;
}

// "Director, Producer and Screenplay" — Oxford-less list join.
function joinNames(names: string[]): string {
	if (names.length <= 1) return names.join("");
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Shared by /credits/person/[id] and /credits/company/[id]: renders one titled grid per role the entity is credited under.
export async function CreditMediaListPage({ kind, id }: Props) {
	// entity and mediaByRole don't depend on each other, so fetch in parallel.
	const [entity, mediaByRole] = await Promise.all([
		kind === "person"
			? db.person.findUnique({ where: { id } })
			: db.company.findUnique({ where: { id } }),
		loadRoleMediaByRole(kind, id),
	]);
	if (!entity) notFound();

	// Every role this entity has a credit under. Actor sorts first (gets the avg-rating row), rest alphabetically. Computed before photoSrc since it also decides that.
	const roleNames = [...mediaByRole.keys()].sort((a, b) => {
		if (a === "Actor") return -1;
		if (b === "Actor") return 1;
		return a.localeCompare(b);
	});

	// Only Person carries a photoPath — the "in" check also narrows entity's type for toPersonPhotoSrc below. Still gated by role eligibility like everywhere else a person's photo might show.
	const photoSrc =
		"photoPath" in entity && hasPhotoEligibleRole(roleNames)
			? toPersonPhotoSrc(entity.id, entity.photoPath)
			: null;

	const roleGroups = roleNames.map((name) => ({
		name,
		media: mediaByRole.get(name)!,
	}));

	// Average of personal and public ratings, scoped to creative-role credits when any exist (deduped so a writer-director's title isn't counted twice); otherwise falls back to every credited title.
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

	// Roles credited on the exact same set of titles share one grid instead of two identical ones back to back. Order of first appearance preserved, so Actor still leads when merged.
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
	// Most-credited role group first — a more useful default than roleNames' query order (Actor-first/alphabetical).
	const mergedGroups = [...groupByMediaKey.values()].sort(
		(a, b) => b.media.length - a.media.length,
	);

	// Only the top group gets its own titled grid; the rest collapse into one "Also involved in" grid so a prolific credit list doesn't sprawl. Deduped by media id and excludes anything already in the top group.
	const [topGroup, ...restGroups] = mergedGroups;
	const topMediaIds = new Set(topGroup?.media.map((item) => item.id) ?? []);
	const otherMedia = [
		...new Map(
			restGroups
				.flatMap((group) => group.media)
				.filter((item) => !topMediaIds.has(item.id))
				.map((item) => [item.id, item]),
		).values(),
	];

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
				<>
					{topGroup && (
						<div className={styles.other_role_group}>
							<h2 className={styles.other_role_title}>
								{topGroup.names.length === 1 && topGroup.names[0] === "Actor"
									? "Starring in"
									: joinNames(topGroup.names)}
							</h2>
							<MediaCardDisplayProvider showTitle={false}>
								<LazyMediaGrid items={topGroup.media} />
							</MediaCardDisplayProvider>
						</div>
					)}
					{otherMedia.length > 0 && (
						<div className={styles.other_role_group}>
							<h2 className={styles.other_role_title}>Also involved in</h2>
							<MediaCardDisplayProvider showTitle={false}>
								<LazyMediaGrid items={otherMedia} />
							</MediaCardDisplayProvider>
						</div>
					)}
				</>
			)}
		</div>
	);
}
