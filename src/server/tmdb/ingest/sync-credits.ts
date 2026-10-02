import { type MediaType, type Prisma, Source } from "@prisma/client";
import type { TmdbMovieResponse } from "@/server/tmdb/schema";
import {
	resolveCompaniesBatch,
	resolveCountriesBatch,
	resolveGenresBatch,
	resolvePeopleBatch,
	resolveRolesBatch,
} from "@/server/resolvers/batch-entity-resolver";
import { capCast, filterNotableCrew } from "@/server/tmdb/ingest/credit-limits";

type t_client = Prisma.TransactionClient;

// Movie shapes; TV flattens its aggregate_credits into the same ones (tv-show-credits.ts).
export type TmdbCreditsInput = {
	genres: TmdbMovieResponse["genres"];
	cast: TmdbMovieResponse["credits"]["cast"];
	crew: TmdbMovieResponse["credits"]["crew"];
	companies: TmdbMovieResponse["production_companies"];
};

// Batched rather than one round trip per cast/crew/company member — a large ensemble cast could
// rack up 100+ sequential round trips, enough to blow an interactive-transaction timeout.
export async function syncTmdbCreditsAndGenres(
	tx: t_client,
	mediaId: number,
	origin: MediaType,
	input: TmdbCreditsInput,
) {
	await tx.credit.deleteMany({ where: { mediaId } });
	await tx.mediaGenre.deleteMany({ where: { mediaId } });

	// --- Collect every reference this media needs, no DB calls yet ---

	const genreInputs = input.genres.map((g) => ({ name: g.name, origin }));

	const cast = capCast(input.cast);
	const crew = filterNotableCrew(input.crew);
	const companies = input.companies;

	// Which photoPath actually gets downloaded/cached is a read-time decision (person-photo-eligibility.ts), not this ingest step.
	const personInputs = [...cast, ...crew].map((c) => ({
		externalId: String(c.id),
		source: Source.TMDB,
		name: c.name,
		photoPath: c.profile_path,
	}));

	// Every role the credits could need: "Actor" (if cast), each crew member's job title, "Studio" (if companies).
	const roleInputs = [
		...(cast.length ? [{ name: "Actor", origin }] : []),
		...crew.map((c) => ({ name: c.job, origin })),
		...(companies.length ? [{ name: "Studio", origin }] : []),
	];

	// Countries must resolve before companies — a company's countryId comes from this.
	const countryInputs = companies
		.filter((co) => co.origin_country)
		.map((co) => ({ code2: co.origin_country }));

	// Sequential (not Promise.all); concurrent queries in transaction bug.
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

	// Iterates ORIGINAL arrays; each credit needs own row (even same actor/different char).

	const mediaGenreRows = genreInputs.map((g) => ({
		mediaId,
		genreId: genreMap.get(`${g.origin}:${g.name}`)!,
	}));

	const actorRoleId = cast.length ? roleMap.get(`${origin}:Actor`)! : null;
	const studioRoleId = companies.length
		? roleMap.get(`${origin}:Studio`)!
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
			roleId: roleMap.get(`${origin}:${c.job}`)!,
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
