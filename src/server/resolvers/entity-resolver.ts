import { MediaType, Prisma, Source } from "@prisma/client";

type t_client = Prisma.TransactionClient;

export async function resolvePerson(
	tx: t_client,
	externalId: string,
	source: Source,
	name: string,
) {
	if (!externalId) throw new Error("resolvePerson: missing externalId");
	if (!name) throw new Error("resolvePerson: missing name");

	return tx.person.upsert({
		where: { externalId_source: { externalId, source } },
		update: { name },
		create: { name, externalId, source },
	});
}

export async function resolveRole(
	tx: t_client,
	name: string,
	origin: MediaType,
) {
	if (!name) throw new Error("resolveRole: missing name");

	// update writes name back unchanged rather than {} — Prisma's upsert
	// translates an empty update into `ON CONFLICT DO NOTHING`, and when the
	// conflict actually fires (the row already exists), DO NOTHING means
	// RETURNING comes back with zero rows instead of the existing row, so
	// upsert() resolves to an empty result rather than the row callers
	// expect. https://github.com/prisma/prisma/issues/21853. A real (even if
	// value-identical) update field forces a genuine DO UPDATE, which always
	// returns the row.
	return tx.role.upsert({
		where: { name_origin: { name, origin } },
		update: { name },
		create: { name, origin },
	});
}

export async function resolveCompany(
	tx: t_client,
	externalId: string,
	source: Source,
	name: string,
	type: string,
	logoPath: string | null = null,
	countryId: number | null = null,
) {
	if (!externalId) throw new Error("resolveCompany: missing externalId");
	if (!name) throw new Error("resolveCompany: missing name");

	return tx.company.upsert({
		where: { externalId_source: { externalId, source } },
		update: { name, logoPath },
		create: { name, externalId, source, type, logoPath, countryId },
	});
}

export async function resolveCountry(
	tx: t_client,
	code2?: string | null,
	name?: string,
) {
	if (!code2) throw new Error("resolveCountry: missing code2");

	const countryCode = code2.toUpperCase();

	// See resolveRole's comment on why update can't be {}. Self-referencing
	// the unique key field (rather than name, like resolveRole does) since
	// name here is optional — a later call that omits it shouldn't clobber
	// an existing row's real name with the countryCode2 fallback.
	return tx.country.upsert({
		where: { countryCode2: countryCode },
		update: { countryCode2: countryCode },
		create: { countryCode2: countryCode, name: name ?? countryCode },
	});
}

export async function resolveGenre(
	tx: t_client,
	name: string,
	origin: MediaType,
) {
	if (!name) throw new Error("resolveGenre: missing name");
	if (!origin) throw new Error("resolveGenre: missing origin");

	// See resolveRole's comment on why update can't be {} — same fix here.
	return tx.genre.upsert({
		where: { name_origin: { name, origin } },
		update: { name },
		create: { name, origin },
	});
}
