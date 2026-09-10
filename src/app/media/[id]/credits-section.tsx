import { Link } from "@/components/ui/link";
import { MediaType } from "@prisma/client";
import { toPersonPhotoSrc } from "@/server/resolvers/poster-resolver";
import { MAX_BILLED_CAST } from "@/server/tmdb/ingest/credit-limits";
import { getMediaCredits } from "./get-media";
import { CastPhotos } from "./cast-photos";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./media-detail.module.sass";

// Known roles get priority rank; rest sort alphabetically.
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

export type CreditLink = {
	key: string;
	href: string;
	name: string;
	order: number | null;
	// Only ever set on Actor entries, gated by role so other credits (Director) don't show photos.
	photoSrc: string | null;
	// Only ever set on Actor entries, same gating as photoSrc.
	character: string | null;
};

// Names comma-separated for inline prose (byline) or flex-wrapped elsewhere
function CreditNames({
	entries,
	flex = false,
}: {
	entries: CreditLink[];
	flex?: boolean;
}) {
	return (
		<span className={flex ? styles.credit_names_flex : styles.credit_names}>
			{entries.map((entry, i) => (
				<span key={entry.key}>
					{!flex && i > 0 && (
						<span className={styles.credit_separator}>,</span>
					)}
					<Link href={entry.href} className={styles.credit_link}>
						{entry.name}
					</Link>
				</span>
			))}
		</span>
	);
}

// Shared by MediaDirectorCredit and MediaCreditsDetails. Both need same grouped-by-role shape, just render different slices.
async function groupCredits(mediaId: number, type: MediaType) {
	const credits = await getMediaCredits(mediaId);

	// Dedupe credits per role by id (not name); keep first.
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

	// Director/Cast/Studio surface directly; others stay in collapsed list ranked by ROLE_PRIORITY.
	const directorRoleEntries = [
		...(creditsByRole.get("Director")?.values() ?? []),
	];
	const creatorRoleEntries = [
		...(creditsByRole.get("Creator")?.values() ?? []),
	];
	// Manga: author/artist (no director concept) merged in byline, deduped by person
	const authorArtistEntries = [
		...new Map(
			[
				...(creditsByRole.get("Author")?.values() ?? []),
				...(creditsByRole.get("Artist")?.values() ?? []),
			].map((entry) => [entry.key, entry]),
		).values(),
	];

	// TV shows: aggregate_credits' "Director" reflects every episode's director (50+ names for long series), not show creator. Comics: everyone under generic "Creator" role (closest to byline).
	const promoteCreator =
		(type === MediaType.TVSHOW || type === MediaType.COMIC) &&
		creatorRoleEntries.length > 0;
	const promoteAuthorArtist =
		type === MediaType.MANGA && authorArtistEntries.length > 0;
	// Capped at 2 — quick "who made this", not full credits.
	const directorEntries = (
		promoteCreator
			? creatorRoleEntries
			: promoteAuthorArtist
				? authorArtistEntries
				: directorRoleEntries
	).slice(0, 2);

	const studioEntries = [...(creditsByRole.get("Studio")?.values() ?? [])];
	const actorEntries = [...(creditsByRole.get("Actor")?.values() ?? [])]
		.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
		.slice(0, MAX_BILLED_CAST);

	// Director/Creator/Author stay here too even when promoted to byline (max 2 shown).
	// Studio/Actor are fully promoted out with dedicated sections.
	const otherRoles = [...creditsByRole.entries()]
		.filter(([role]) => role !== "Studio" && role !== "Actor")
		.sort(([a], [b]) => {
			const priorityDiff = (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99);
			return priorityDiff !== 0 ? priorityDiff : a.localeCompare(b);
		});

	return { directorEntries, studioEntries, actorEntries, otherRoles };
}

// Split into own Suspense boundary so title doesn't wait on credits query
export async function MediaDirectorCredit({
	mediaId,
	type,
}: {
	mediaId: number;
	type: MediaType;
}) {
	const [{ directorEntries }, dict] = await Promise.all([
		groupCredits(mediaId, type),
		getDictionary(),
	]);
	if (directorEntries.length === 0) return null;

	return (
		<span className={styles.title_director}>
			{dict.mediaDetail.byCreditPrefix} <CreditNames entries={directorEntries} />
		</span>
	);
}

// Details section (cast strip, Studio fact, collapsed credits). Split into own <Suspense> boundary so doesn't gate rest of page. React.cache dedupes getMediaCredits.
export async function MediaCreditsDetails({
	mediaId,
	type,
}: {
	mediaId: number;
	type: MediaType;
}) {
	const [{ studioEntries, actorEntries, otherRoles }, dict] = await Promise.all([
		groupCredits(mediaId, type),
		getDictionary(),
	]);

	return (
		<>
			{actorEntries.length > 0 && (
				<div className={styles.cast_group}>
					<span className={styles.fact_label}>{dict.mediaDetail.cast}</span>
					<CastPhotos entries={actorEntries} />
				</div>
			)}

			{studioEntries.length > 0 && (
				<dl className={styles.facts}>
					<div className={styles.fact}>
						<dt className={styles.fact_label}>{dict.mediaDetail.studio}</dt>
						<dd className={styles.fact_value}>
							<CreditNames entries={studioEntries} flex />
						</dd>
					</div>
				</dl>
			)}

			{otherRoles.length > 0 && (
				<details className={styles.credits}>
					<summary className={styles.credits_summary}>
						{dict.mediaDetail.creditsHeading}
						<span className={styles.credits_count}>{otherRoles.length}</span>
					</summary>
					<div className={styles.credits_list}>
						{otherRoles.map(([role, entries]) => (
							<div className={styles.credit_row} key={role}>
								<span className={styles.credit_role}>{role}</span>
								<CreditNames entries={[...entries.values()]} flex />
							</div>
						))}
					</div>
				</details>
			)}
		</>
	);
}
