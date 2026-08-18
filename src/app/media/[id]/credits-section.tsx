import Link from "next/link";
import { toPersonPhotoSrc } from "@/server/resolvers/poster-resolver";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { getMediaCredits } from "./get-media";
import styles from "./media-detail.module.sass";

// Director/Actor/Studio are promoted out of the collapsed credits list (see
// below) — everything left in there is a long tail that varies a lot by
// source (TMDB crew jobs are free text, MangaDex/ComicVine/IGDB each have
// their own handful of role names). Known roles worth surfacing first get a
// rank here; anything unlisted falls back to alphabetical after them.
const ROLE_PRIORITY: Record<string, number> = {
	Writer: 0,
	Screenplay: 0,
	Creator: 0,
	Author: 0,
	Developer: 0,
	Story: 1,
	Artist: 1,
	Publisher: 1,
	"Executive Producer": 2,
	Producer: 3,
};

const TOP_ACTOR_COUNT = 10;

type CreditLink = {
	key: string;
	href: string;
	name: string;
	order: number | null;
	// Only ever set on Actor entries (see the credit-building loop below) —
	// Person.photoPath itself is cast-only, and this is gated by role on top
	// of that so a person who's also credited as e.g. Director elsewhere
	// still never shows a photo there.
	photoSrc: string | null;
	// Only ever set on Actor entries, same gating as photoSrc.
	character: string | null;
};

// Comma-separated linked names — shared by the promoted Director/Cast/Studio
// facts and each row of the collapsed "everything else" list.
function CreditNames({ entries }: { entries: CreditLink[] }) {
	return (
		<span className={styles.credit_names}>
			{entries.map((entry, i) => (
				<span key={entry.key}>
					{i > 0 && ", "}
					<Link href={entry.href} className={styles.credit_link}>
						{entry.name}
					</Link>
				</span>
			))}
		</span>
	);
}

// Cast's own row, shown as a strip of small headshots (name underneath
// each) instead of comma-separated text — an actor with no photo (never
// backfilled yet, or TMDB just doesn't have one) gets PersonPhoto's own
// placeholder tile instead of falling back to text, so the row stays a
// consistent strip of same-shaped tiles either way.
function CastPhotos({ entries }: { entries: CreditLink[] }) {
	return (
		<span className={styles.cast_photos}>
			{entries.map((entry) => (
				<Link
					key={entry.key}
					href={entry.href}
					className={styles.cast_photo_link}>
					<PersonPhoto src={entry.photoSrc} alt={entry.name} />
					<span className={styles.cast_photo_name}>{entry.name}</span>
					{entry.character && (
						<span className={styles.cast_photo_character}>
							{entry.character}
						</span>
					)}
				</Link>
			))}
		</span>
	);
}

// Shared by MediaDirectorCredit and MediaCreditsDetails below — both need
// the same grouped-by-role shape off the same getMediaCredits call, just to
// render different slices of it (director only vs. cast/studio/everything
// else).
async function groupCredits(mediaId: number) {
	const credits = await getMediaCredits(mediaId);

	// Same person/company can be attached to a role more than once (e.g.
	// duplicate TMDB credit rows) — dedupe per role by id, not just name, so
	// two different people who happen to share a name don't collapse. Only
	// the first occurrence is kept: credits is already ordered by billing
	// order ascending, so for Actor that's the earliest (most prominent) row
	// for that person.
	const creditsByRole = new Map<string, Map<string, CreditLink>>();
	for (const credit of credits) {
		const entry = credit.person
			? {
					key: `person-${credit.person.id}`,
					href: `/credits/person/${credit.person.id}`,
					name: credit.person.name,
					order: credit.order,
					photoSrc:
						credit.role.name === "Actor"
							? toPersonPhotoSrc(credit.person.id, credit.person.photoPath)
							: null,
					character: credit.role.name === "Actor" ? credit.character : null,
				}
			: credit.company
				? {
						key: `company-${credit.company.id}`,
						href: `/credits/company/${credit.company.id}`,
						name: credit.company.name,
						order: credit.order,
						photoSrc: null,
						character: null,
					}
				: null;
		if (!entry) continue;
		const byRole = creditsByRole.get(credit.role.name);
		if (byRole) {
			if (!byRole.has(entry.key)) byRole.set(entry.key, entry);
		} else {
			creditsByRole.set(credit.role.name, new Map([[entry.key, entry]]));
		}
	}

	// Director/Cast/Studio surface directly on the page — everything else
	// (writers, producers, publishers, ...) stays in the collapsed list,
	// ranked by ROLE_PRIORITY rather than left in arbitrary credit order.
	const directorEntries = [...(creditsByRole.get("Director")?.values() ?? [])];
	const studioEntries = [...(creditsByRole.get("Studio")?.values() ?? [])];
	const actorEntries = [...(creditsByRole.get("Actor")?.values() ?? [])]
		.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
		.slice(0, TOP_ACTOR_COUNT);

	const otherRoles = [...creditsByRole.entries()]
		.filter(
			([role]) => role !== "Director" && role !== "Studio" && role !== "Actor",
		)
		.sort(([a], [b]) => {
			const priorityDiff = (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99);
			return priorityDiff !== 0 ? priorityDiff : a.localeCompare(b);
		});

	return { directorEntries, studioEntries, actorEntries, otherRoles };
}

// Sits inline in the title row ("<Title> by <Director>") — split into its
// own component (and <Suspense> boundary, see page.tsx) purely so the title
// itself doesn't wait on the credits query to render.
export async function MediaDirectorCredit({ mediaId }: { mediaId: number }) {
	const { directorEntries } = await groupCredits(mediaId);
	if (directorEntries.length === 0) return null;

	return (
		<span className={styles.title_director}>
			by <CreditNames entries={directorEntries} />
		</span>
	);
}

// The Details section's cast strip / Studio fact / collapsed "everything
// else" credits list — split into its own component (and <Suspense>
// boundary, see page.tsx) so it doesn't gate the rest of the page either.
// Calls the same getMediaCredits as MediaDirectorCredit above; React.cache
// means that's one shared query, not two.
export async function MediaCreditsDetails({ mediaId }: { mediaId: number }) {
	const { studioEntries, actorEntries, otherRoles } =
		await groupCredits(mediaId);

	return (
		<>
			{actorEntries.length > 0 && (
				<div className={styles.cast_group}>
					<span className={styles.fact_label}>Cast</span>
					<CastPhotos entries={actorEntries} />
				</div>
			)}

			{studioEntries.length > 0 && (
				<dl className={styles.facts}>
					<div className={styles.fact}>
						<dt className={styles.fact_label}>Studio</dt>
						<dd className={styles.fact_value}>
							<CreditNames entries={studioEntries} />
						</dd>
					</div>
				</dl>
			)}

			{otherRoles.length > 0 && (
				<details className={styles.credits}>
					<summary className={styles.credits_summary}>
						Credits
						<span className={styles.credits_count}>{otherRoles.length}</span>
					</summary>
					<div className={styles.credits_list}>
						{otherRoles.map(([role, entries]) => (
							<div className={styles.credit_row} key={role}>
								<span className={styles.credit_role}>{role}</span>
								<CreditNames entries={[...entries.values()]} />
							</div>
						))}
					</div>
				</details>
			)}
		</>
	);
}
