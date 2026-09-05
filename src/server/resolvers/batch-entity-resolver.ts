import { MediaType, Prisma, Source } from "@prisma/client";

type t_client = Prisma.TransactionClient;

// Required, not optional: a single createMany call doesn't dedupe within its own `data` array, so two inputs sharing a unique key would violate the constraint in one INSERT. First occurrence wins.
function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
	const seen = new Map<string, T>();
	for (const item of items) {
		const key = keyFn(item);
		if (!seen.has(key)) seen.set(key, item);
	}
	return [...seen.values()];
}

// Batch counterparts; uses findMany-then-createMany (upsert has Prisma bug #21853)

// Unlike resolveCompaniesBatch's logoPath (create-only), an existing person missing a photo gets backfilled here; one that already has one is never overwritten.
export async function resolvePeopleBatch(
	tx: t_client,
	inputs: {
		externalId: string;
		source: Source;
		name: string;
		// Which photos actually get downloaded/cached is a read-time decision (person-photo-eligibility.ts), not this resolve step's concern.
		photoPath?: string | null | undefined;
	}[],
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (inputs.length === 0) return map;

	const key = (i: { externalId: string; source: Source }) =>
		`${i.source}:${i.externalId}`;
	const deduped = dedupeByKey(inputs, key);

	const existing = await tx.person.findMany({
		where: {
			OR: deduped.map((i) => ({ externalId: i.externalId, source: i.source })),
		},
		select: { id: true, externalId: true, source: true, photoPath: true },
	});
	for (const row of existing) map.set(key(row), row.id);

	// Backfill: person from before photoPath existed gets caught up on re-enrichment, not left blank. Per-person updates (no bulk "set different per row" in Prisma); sequential to avoid concurrent-query transaction bug.
	const existingByKey = new Map(existing.map((row) => [key(row), row]));
	for (const input of deduped) {
		if (!input.photoPath) continue;
		const row = existingByKey.get(key(input));
		if (row && row.photoPath == null) {
			await tx.person.update({
				where: { id: row.id },
				data: { photoPath: input.photoPath },
			});
		}
	}

	const missing = deduped.filter((i) => !map.has(key(i)));
	if (missing.length > 0) {
		const created = await tx.person.createManyAndReturn({
			data: missing.map((i) => ({
				externalId: i.externalId,
				source: i.source,
				name: i.name,
				photoPath: i.photoPath ?? null,
			})),
			select: { id: true, externalId: true, source: true },
		});
		for (const row of created) map.set(key(row), row.id);
	}

	return map;
}

export async function resolveRolesBatch(
	tx: t_client,
	inputs: { name: string; origin: MediaType }[],
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (inputs.length === 0) return map;

	const key = (i: { name: string; origin: MediaType }) =>
		`${i.origin}:${i.name}`;
	const deduped = dedupeByKey(inputs, key);

	const existing = await tx.role.findMany({
		where: { OR: deduped.map((i) => ({ name: i.name, origin: i.origin })) },
		select: { id: true, name: true, origin: true },
	});
	for (const row of existing) map.set(key(row), row.id);

	const missing = deduped.filter((i) => !map.has(key(i)));
	if (missing.length > 0) {
		const created = await tx.role.createManyAndReturn({
			data: missing,
			select: { id: true, name: true, origin: true },
		});
		for (const row of created) map.set(key(row), row.id);
	}

	return map;
}

export async function resolveGenresBatch(
	tx: t_client,
	inputs: { name: string; origin: MediaType }[],
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (inputs.length === 0) return map;

	const key = (i: { name: string; origin: MediaType }) =>
		`${i.origin}:${i.name}`;
	const deduped = dedupeByKey(inputs, key);

	const existing = await tx.genre.findMany({
		where: { OR: deduped.map((i) => ({ name: i.name, origin: i.origin })) },
		select: { id: true, name: true, origin: true },
	});
	for (const row of existing) map.set(key(row), row.id);

	const missing = deduped.filter((i) => !map.has(key(i)));
	if (missing.length > 0) {
		const created = await tx.genre.createManyAndReturn({
			data: missing,
			select: { id: true, name: true, origin: true },
		});
		for (const row of created) map.set(key(row), row.id);
	}

	return map;
}

// Keyed by countryCode2 (uppercase, per entity-resolver.ts).
export async function resolveCountriesBatch(
	tx: t_client,
	inputs: { code2: string; name?: string }[],
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (inputs.length === 0) return map;

	const normalized = inputs.map((i) => ({
		countryCode2: i.code2.toUpperCase(),
		name: i.name,
	}));
	const deduped = dedupeByKey(normalized, (i) => i.countryCode2);

	const existing = await tx.country.findMany({
		where: { countryCode2: { in: deduped.map((i) => i.countryCode2) } },
		select: { id: true, countryCode2: true },
	});
	for (const row of existing) map.set(row.countryCode2, row.id);

	const missing = deduped.filter((i) => !map.has(i.countryCode2));
	if (missing.length > 0) {
		const created = await tx.country.createManyAndReturn({
			data: missing.map((i) => ({
				countryCode2: i.countryCode2,
				name: i.name ?? i.countryCode2,
			})),
			select: { id: true, countryCode2: true },
		});
		for (const row of created) map.set(row.countryCode2, row.id);
	}

	return map;
}

// countryId matters only on create; existing rows keep current value.
// Doesn't refresh name/logoPath (unlike entity-resolver)—not worth the round trip.
export async function resolveCompaniesBatch(
	tx: t_client,
	inputs: {
		externalId: string;
		source: Source;
		name: string;
		type: string;
		logoPath?: string | null;
		countryId?: number | null;
	}[],
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (inputs.length === 0) return map;

	const key = (i: { externalId: string; source: Source }) =>
		`${i.source}:${i.externalId}`;
	const deduped = dedupeByKey(inputs, key);

	const existing = await tx.company.findMany({
		where: {
			OR: deduped.map((i) => ({ externalId: i.externalId, source: i.source })),
		},
		select: { id: true, externalId: true, source: true },
	});
	for (const row of existing) map.set(key(row), row.id);

	const missing = deduped.filter((i) => !map.has(key(i)));
	if (missing.length > 0) {
		const created = await tx.company.createManyAndReturn({
			data: missing.map((i) => ({
				externalId: i.externalId,
				source: i.source,
				name: i.name,
				type: i.type,
				logoPath: i.logoPath ?? null,
				countryId: i.countryId ?? null,
			})),
			select: { id: true, externalId: true, source: true },
		});
		for (const row of created) map.set(key(row), row.id);
	}

	return map;
}
