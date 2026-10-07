import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus, Prisma } from "@prisma/client";
import { MediaRecord, toMediaRecord } from "@/components/media/types";

// Out of 10 — only well-liked, written-up titles are worth resurfacing.
const MIN_RATING = 7;
export const RANDOM_PICK_COUNT = 4;

const RANDOM_PICK_WHERE: Prisma.MediaWhereInput = {
	enrichmentStatus: EnrichmentStatus.DONE,
	isAdult: false,
	review: {
		rating: { gte: MIN_RATING },
		AND: [{ body: { not: null } }, { body: { not: "" } }],
	},
};

// `count` distinct indexes out of [0, total), in random order.
function randomOffsets(total: number, count: number): number[] {
	const offsets = new Set<number>();
	while (offsets.size < Math.min(count, total)) {
		offsets.add(Math.floor(Math.random() * total));
	}
	return [...offsets];
}

// Uniform picks via count + random skips; excludeIds keeps "spin again" from repeating the current set.
export async function loadRandomPicks(
	excludeIds: number[],
): Promise<MediaRecord[]> {
	const where: Prisma.MediaWhereInput =
		excludeIds.length === 0
			? RANDOM_PICK_WHERE
			: { ...RANDOM_PICK_WHERE, id: { notIn: excludeIds } };
	const total = await dbPublic.media.count({ where });

	const picks = await Promise.all(
		randomOffsets(total, RANDOM_PICK_COUNT).map((skip) =>
			dbPublic.media.findFirst({
				where,
				include: {
					movie: true,
					tvShow: true,
					manga: true,
					comic: true,
					game: true,
					book: true,
					review: true,
				},
				orderBy: { id: "asc" },
				skip,
			}),
		),
	);
	return picks.filter((raw) => raw !== null).map(toMediaRecord);
}
