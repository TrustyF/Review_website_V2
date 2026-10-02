import type { Prisma } from "@prisma/client";

type t_client = Prisma.TransactionClient;

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
