import { MediaType } from "@prisma/client";

// Different sources need different ratios; kept here because poster.tsx is client-only.
export function posterRatioFor(type: MediaType): string {
	if (type === MediaType.COMIC || type === MediaType.GAME) return "3/4";
	// if (type === MediaType.MANGA) return "7/10";
	return "2/3";
}
