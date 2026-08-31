import { MediaType, Prisma, Source } from "@prisma/client";
import { TmdbMovieResponse } from "@/server/tmdb/schema";
import {
	resolveCompaniesBatch,
	resolveCountriesBatch,
	resolveGenresBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";
import { capCast, filterNotableCrew } from "@/server/tmdb/ingest/credit-limits";

type t_client = Prisma.TransactionClient;

// Batched rather than one round trip per cast/crew/company member — a large ensemble cast could
// rack up 100+ sequential round trips, enough to blow an interactive-transaction timeout.
export async function syncMovieCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	data: TmdbMovieResponse,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	// --- Collect every reference this movie needs, no DB calls yet ---

	const genreInputs = (data.genres ?? []).map((g) => ({
		name: g.name,
		origin: MediaType.MOVIE,
	}));

	const cast = capCast(data.credits?.cast ?? []);
	const crew = filterNotableCrew(data.credits?.crew ?? []);
	const companies = data.production_companies ?? [];

	// Which photoPath actually gets downloaded/cached is a read-time decision (person-photo-eligibility.ts), not this ingest step.
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

	// Every role this movie's credits could need, resolved in one call:
	// "Actor" (only if there's a cast), each crew member's own job title,
	// "Studio" (only if there are companies).
	const roleInputs = [
		...(cast.length ? [{ name: "Actor", origin: MediaType.MOVIE }] : []),
		...crew.map((c) => ({ name: c.job, origin: MediaType.MOVIE })),
		...(companies.length ? [{ name: "Studio", origin: MediaType.MOVIE }] : []),
	];

	// Countries must resolve before companies — a company's countryId comes from this.
	const countryInputs = companies
		.filter((co) => co.origin_country)
		.map((co) => ({ code2: co.origin_country! }));

	// --- Resolve every reference type exactly once ---
	// Sequential, not Promise.all — concurrent queries against one interactive transaction's shared
	// session previously caused a real empty-result bug (see entity-resolver.ts's resolveRole).
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
	// Iterates the ORIGINAL (un-deduped) arrays — every credit still needs its own row even when
	// it shares a person/role/company with another (e.g. the same actor twice with different characters).

	const mediaGenreRows = genreInputs.map((g) => ({
		mediaId,
		genreId: genreMap.get(`${g.origin}:${g.name}`)!,
	}));

	const actorRoleId = cast.length
		? roleMap.get(`${MediaType.MOVIE}:Actor`)!
		: null;
	const studioRoleId = companies.length
		? roleMap.get(`${MediaType.MOVIE}:Studio`)!
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
			roleId: roleMap.get(`${MediaType.MOVIE}:${c.job}`)!,
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
