import type { Metadata } from "next";
import { EnrichmentStatus } from "@prisma/client";
import { db } from "@/server/db/client";

// Below this many titles a credit page is thin content: kept out of the index, links still followed.
const MIN_INDEXABLE_MEDIA = 5;

// Counts the same media the page shows (DONE, not deleted), deduped across roles.
export async function creditRobots(
	kind: "person" | "company",
	id: number,
): Promise<Metadata["robots"]> {
	const count = await db.media.count({
		where: {
			enrichmentStatus: EnrichmentStatus.DONE,
			isDeleted: false,
			credits: {
				some: kind === "person" ? { personId: id } : { companyId: id },
			},
		},
	});
	return count < MIN_INDEXABLE_MEDIA
		? { index: false, follow: true }
		: undefined;
}
