"use server";
import { MediaRecord } from "@/components/media/types";
import { loadRandomPicks, RANDOM_PICK_COUNT } from "./random-pick-query";

export async function fetchRandomPicks(
	excludeIds: number[],
): Promise<MediaRecord[]> {
	const ids = Array.isArray(excludeIds)
		? excludeIds
				.filter((id) => Number.isInteger(id))
				.slice(0, RANDOM_PICK_COUNT)
		: [];
	return loadRandomPicks(ids);
}
