"use server";
import {
	loadRecentMediaSection,
	RecentMediaSectionData,
} from "./recent-media-query";
import { isRecentMediaGroup } from "./recent-media-groups";

export async function fetchRecentMediaSection(
	group: string,
): Promise<RecentMediaSectionData> {
	if (!isRecentMediaGroup(group)) throw new Error("Unknown media group");
	return loadRecentMediaSection(group);
}
