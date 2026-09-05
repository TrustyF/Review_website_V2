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

	// Empty update causes DO NOTHING (no return); real update field forces DO UPDATE.
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

	// Self-references unique key since name is optional; later omit shouldn't clobber
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
