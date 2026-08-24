import { MediaType, Prisma, Source } from "@prisma/client";
import { TmdbTvResponse } from "@/server/tmdb/schema";
import {
	resolveCompaniesBatch,
	resolveCountriesBatch,
	resolveGenresBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";
import { capCast, filterNotableCrew } from "@/server/tmdb/ingest/credit-limits";

type t_client = Prisma.TransactionClient;

// Replaces a TV show's genres and credits with the latest TMDB data. Safe to
// call for a brand-new media row (nothing to delete/recreate over) or to
// re-sync an existing one on re-enrichment.
//
// Batched rather than one round trip per cast/crew/company member — see
// movie-credits.ts's own comment (this is the same shape, just
// MediaType.TVSHOW) and batch-entity-resolver.ts for how each resolve*
// below collapses a whole show's worth of references into one findMany +
// createMany instead of one round trip per person/role/company.
export async function syncTvShowCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	data: TmdbTvResponse,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	// --- Collect every reference this show needs, no DB calls yet ---

	const genreInputs = (data.genres ?? []).map((g) => ({
		name: g.name,
		origin: MediaType.TVSHOW,
	}));

	// aggregate_credits' cast entries carry one row per *person*, with their
	// role(s) nested inside (a person can rack up more than one across a
	// show's run — recast into a different part — where a movie credit never
	// does). Flattened back to the same {id, name, character, order, ...}
	// shape credits.cast used to have, but order is reassigned by rank here
	// rather than trusted from TMDB — see TmdbTvResponseSchema's own comment
	// on why aggregate_credits' own order field doesn't reflect billing
	// prominence at all. total_episode_count does: sorted descending, so
	// capCast below actually keeps the show's real regulars, not whoever
	// happened to get a low order for unrelated reasons.
	const rawCast = [...data.aggregate_credits.cast]
		.sort((a, b) => b.total_episode_count - a.total_episode_count)
		.map((c, i) => ({
			id: c.id,
			name: c.name,
			character: c.roles.map((r) => r.character).join(" / "),
			order: i,
			profile_path: c.profile_path,
		}));
	// created_by is a separate top-level field, not a crew job — TMDB tracks
	// a show's actual creator(s) independently of any per-episode crew credit
	// (there's no equivalent "who created this" job title in aggregate_
	// credits.crew at all). Folded in here as a synthetic "Creator" crew
	// entry anyway, since NOTABLE_CREW_JOBS already expects that role name —
	// this is the only path that ever actually populates it now. department
	// is never read back out of a credit row downstream, so its value here
	// doesn't matter beyond satisfying the shared shape.
	const rawCreators = (data.created_by ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		job: "Creator",
		department: "Creative",
		profile_path: c.profile_path,
	}));
	const rawCrew = [
		...data.aggregate_credits.crew.flatMap((c) =>
			c.jobs.map((j) => ({
				id: c.id,
				name: c.name,
				job: j.job,
				department: c.department,
				profile_path: c.profile_path,
			})),
		),
		...rawCreators,
	];
	const cast = capCast(rawCast);
	const crew = filterNotableCrew(rawCrew);
	const companies = data.production_companies ?? [];

	// See movie-credits.ts's own comment on where the photo-eligibility
	// decision actually lives now — not here.
	const personInputs = [
		...cast.map((c) => ({
			externalId: String(c.id),
			source: Source.TMDB,
			name: c.name,
			photoPath: c.profile_path,
		})),
		...crew.map((c) => ({
			externalId: String(c.id),
			source: Source.TMDB,
			name: c.name,
			photoPath: c.profile_path,
		})),
	];

	// Every role this show's credits could need, resolved in one call:
	// "Actor" (only if there's a cast), each crew member's own job title
	// (e.g. "Director", "Creator"), "Studio" (only if there are companies).
	const roleInputs = [
		...(cast.length ? [{ name: "Actor", origin: MediaType.TVSHOW }] : []),
		...crew.map((c) => ({ name: c.job, origin: MediaType.TVSHOW })),
		...(companies.length ? [{ name: "Studio", origin: MediaType.TVSHOW }] : []),
	];

	// Countries have to resolve before companies — a company's countryId
	// comes from this.
	const countryInputs = companies
		.filter((co) => co.origin_country)
		.map((co) => ({ code2: co.origin_country! }));

	// --- Resolve every reference type exactly once ---
	// Sequential, not Promise.all — see movie-credits.ts's own comment on why.
	const genreMap = await resolveGenresBatch(tx, genreInputs);
	const personMap = await resolvePeopleBatch(tx, personInputs);
	const roleMap = await resolveRolesBatch(tx, roleInputs);
	const countryMap = await resolveCountriesBatch(tx, countryInputs);

	const companyInputs = companies.map((co) => ({
		externalId: String(co.id),
		source: Source.TMDB,
		name: co.name,
		type: "studio",
		logoPath: co.logo_path,
		countryId: co.origin_country
			? (countryMap.get(co.origin_country.toUpperCase()) ?? null)
			: null,
	}));
	const companyMap = await resolveCompaniesBatch(tx, companyInputs);

	// --- Build the final rows in memory, then insert in bulk ---
	// Iterates the ORIGINAL (un-deduped) cast/crew/company arrays — resolve*
	// dedupes references, but every credit itself still needs its own row
	// even when it shares a person/role/company with another.

	const mediaGenreRows = genreInputs.map((g) => ({
		mediaId,
		genreId: genreMap.get(`${g.origin}:${g.name}`)!,
	}));

	const actorRoleId = cast.length
		? roleMap.get(`${MediaType.TVSHOW}:Actor`)!
		: null;
	const studioRoleId = companies.length
		? roleMap.get(`${MediaType.TVSHOW}:Studio`)!
		: null;

	const creditRows: Prisma.CreditCreateManyInput[] = [
		...cast.map((c) => ({
			mediaId,
			roleId: actorRoleId!,
			personId: personMap.get(`${Source.TMDB}:${c.id}`)!,
			order: c.order,
			character: c.character,
		})),
		...crew.map((c) => ({
			mediaId,
			roleId: roleMap.get(`${MediaType.TVSHOW}:${c.job}`)!,
			personId: personMap.get(`${Source.TMDB}:${c.id}`)!,
		})),
		...companies.map((co) => ({
			mediaId,
			roleId: studioRoleId!,
			companyId: companyMap.get(`${Source.TMDB}:${co.id}`)!,
		})),
	];

	if (mediaGenreRows.length) {
		await tx.mediaGenre.createMany({ data: mediaGenreRows });
	}
	if (creditRows.length) {
		await tx.credit.createMany({ data: creditRows });
	}
}
