"use server";
import { MediaRecord } from "@/components/media/types";
import { loadRandomPicks } from "./random-pick-query";

// Current picks plus every home section above; caps what a client can stuff into notIn.
const MAX_EXCLUDE_IDS = 100;

export async function fetchRandomPicks(
	excludeIds: number[],
): Promise<MediaRecord[]> {
	const ids = Array.isArray(excludeIds)
		? excludeIds.filter((id) => Number.isInteger(id)).slice(0, MAX_EXCLUDE_IDS)
		: [];
	return loadRandomPicks(ids);
}
