"use server";
import { MediaType } from "@prisma/client";
import {
	loadRecentMediaSection,
	RecentMediaSectionData,
} from "./recent-media-query";

export async function fetchRecentMediaSection(
	type: MediaType,
): Promise<RecentMediaSectionData> {
	return loadRecentMediaSection(type);
}
