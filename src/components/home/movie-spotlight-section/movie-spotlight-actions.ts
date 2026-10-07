"use server";
import type { MediaCardRecord } from "@/components/media/types";
import {
	loadMovieSpotlight,
	MOVIE_SPOTLIGHT_COUNT,
} from "./movie-spotlight-query";

export async function fetchMovieSpotlight(
	excludeIds: number[],
): Promise<MediaCardRecord[]> {
	const ids = Array.isArray(excludeIds)
		? excludeIds
				.filter((id) => Number.isInteger(id))
				.slice(0, MOVIE_SPOTLIGHT_COUNT)
		: [];
	return loadMovieSpotlight(ids);
}
