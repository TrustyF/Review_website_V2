"use server";
import {
	isSpotlightRole,
	loadRandomPersonSpotlight,
	type PersonSpotlightData,
} from "./person-spotlight-query";

export async function fetchRandomPersonSpotlight(
	currentRole: string,
	currentId: number | null,
): Promise<PersonSpotlightData | null> {
	return loadRandomPersonSpotlight(
		isSpotlightRole(currentRole) ? currentRole : null,
		Number.isInteger(currentId) ? currentId : null,
	);
}
