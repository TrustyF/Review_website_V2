import { unstable_cache } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus, MediaType, Prisma } from "@prisma/client";
import {
	MediaCardRecord,
	toMediaCardRecord,
	toMediaRecord,
} from "@/components/media/types";
import {
	currentWeekIndex,
	pickForWeek,
	sample,
} from "@/components/home/home-rotation";
import { toPersonPhotoSrc } from "@/server/resolvers/asset-paths";
import { PERSON_SPOTLIGHT_TAG } from "@/server/cache/media-cache-tag";

const SPOTLIGHT_COUNT = 14;
// Same floor as the stats page's MIN_SAMPLE_FOR_PERSON_RATING, raised a notch for a whole row.
const MIN_RATED_FILMS = 4;
// Out of 10 — a spotlight should celebrate someone, not resurface a string of misses.
const MIN_AVG_RATING = 6.5;
// Same top-billed cutoff as the stats page's Top People.
const TOP_BILLING_CUTOFF = 10;

const RATED_MOVIE: Prisma.MediaWhereInput = {
	type: MediaType.MOVIE,
	isDeleted: false,
	isAdult: false,
	enrichmentStatus: EnrichmentStatus.DONE,
	review: { rating: { not: null } },
};

// Movie-only, like the stats page's Top People; actors exclude voice roles and cameos.
const CREDIT_WHERE = {
	DIRECTOR: { role: { name: "Director" } },
	ACTOR: {
		role: { name: "Actor" },
		order: { lt: TOP_BILLING_CUTOFF },
		OR: [{ character: null }, { NOT: { character: { contains: "(voice)" } } }],
	},
} satisfies Record<string, Prisma.CreditWhereInput>;

export type SpotlightRole = keyof typeof CREDIT_WHERE;

export function isSpotlightRole(value: unknown): value is SpotlightRole {
	return value === "DIRECTOR" || value === "ACTOR";
}

export type PersonSpotlightData = {
	role: SpotlightRole;
	person: { id: number; name: string; photoSrc: string | null };
	filmCount: number;
	avgRating: number;
	items: MediaCardRecord[];
};

const WEEK_SECONDS = 7 * 24 * 60 * 60;

// Per-person avg isn't expressible in a credit groupBy, so ratings are aggregated here. Sorted by id.
async function queryCandidates(role: SpotlightRole): Promise<number[]> {
	const credits = await db.credit.findMany({
		where: {
			...CREDIT_WHERE[role],
			personId: { not: null },
			media: RATED_MOVIE,
		},
		select: {
			personId: true,
			mediaId: true,
			media: { select: { review: { select: { rating: true } } } },
		},
	});
	// personId -> mediaId -> rating, mediaId-keyed so a double credit counts once.
	const byPerson = new Map<number, Map<number, number>>();
	for (const c of credits) {
		const rating = c.media.review?.rating;
		if (c.personId == null || rating == null) continue;
		const films = byPerson.get(c.personId) ?? new Map<number, number>();
		films.set(c.mediaId, rating);
		byPerson.set(c.personId, films);
	}
	return [...byPerson.entries()]
		.filter(([, films]) => {
			if (films.size < MIN_RATED_FILMS) return false;
			const sum = [...films.values()].reduce((a, b) => a + b, 0);
			return sum / films.size >= MIN_AVG_RATING;
		})
		.map(([personId]) => personId)
		.sort((a, b) => a - b);
}

// The credits scan is the heavy part, so the candidate list is cached per role for the week (keyed by
// week index) and cleared by saveReview on any rating change. Films/averages stay live via loadSpotlight.
function loadCandidates(role: SpotlightRole): Promise<number[]> {
	return unstable_cache(
		() => queryCandidates(role),
		["person-spotlight-candidates", role, String(currentWeekIndex())],
		{ revalidate: WEEK_SECONDS, tags: [PERSON_SPOTLIGHT_TAG] },
	)();
}

async function loadSpotlight(
	role: SpotlightRole,
	personId: number,
): Promise<PersonSpotlightData | null> {
	const [person, raw] = await Promise.all([
		db.person.findUnique({
			where: { id: personId },
			select: { id: true, name: true, photoPath: true },
		}),
		dbPublic.media.findMany({
			where: {
				...RATED_MOVIE,
				credits: { some: { ...CREDIT_WHERE[role], personId } },
			},
			include: { movie: true, review: true },
			orderBy: [{ review: { rating: "desc" } }, { releaseDate: "desc" }],
		}),
	]);
	if (!person) return null;

	const ratings = raw
		.map((m) => m.review?.rating)
		.filter((r): r is number => r != null);
	return {
		role,
		person: {
			id: person.id,
			name: person.name,
			photoSrc: toPersonPhotoSrc(person.id, person.photoPath),
		},
		filmCount: raw.length,
		avgRating: ratings.reduce((a, b) => a + b, 0) / (ratings.length || 1),
		items: raw
			.slice(0, SPOTLIGHT_COUNT)
			.map((m) => toMediaCardRecord(toMediaRecord(m))),
	};
}

// Alternates weekly between a director and an actor, each rotating through its own candidates.
export async function loadWeeklyPersonSpotlight() {
	const week = currentWeekIndex();
	const role: SpotlightRole = week % 2 === 0 ? "DIRECTOR" : "ACTOR";
	const personId = pickForWeek(
		await loadCandidates(role),
		Math.floor(week / 2),
	);
	return personId == null ? null : loadSpotlight(role, personId);
}

// "Spin again": any other qualifying director or actor, whichever role the current pick has.
export async function loadRandomPersonSpotlight(
	currentRole: SpotlightRole | null,
	currentId: number | null,
) {
	const [directors, actors] = await Promise.all([
		loadCandidates("DIRECTOR"),
		loadCandidates("ACTOR"),
	]);
	const pool = [
		...directors.map((personId) => ({ role: "DIRECTOR" as const, personId })),
		...actors.map((personId) => ({ role: "ACTOR" as const, personId })),
	];
	const others = pool.filter(
		(c) => c.role !== currentRole || c.personId !== currentId,
	);
	const [pick] = sample(others.length > 0 ? others : pool, 1);
	return pick ? loadSpotlight(pick.role, pick.personId) : null;
}
