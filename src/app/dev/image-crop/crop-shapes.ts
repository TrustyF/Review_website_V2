// Client-safe shape metadata; separate from server-only since
// "use client" can't import fs/sharp.
export type CropShapeId =
	| "poster-2-3"
	| "poster-3-4"
	| "banner-16-9"
	| "digest-banner"
	| "list-thumbnail-16-9"
	| "avatar-1-1";

export const CROP_SHAPES: Record<
	CropShapeId,
	{
		label: string;
		ratio: number;
		// UI guide only — draws a circular mask hinting at the consumer's own
		// border-radius crop; the saved file always stays a plain rectangle.
		cropShape?: "rect" | "round";
	}
> = {
	"poster-2-3": { label: "Poster (2:3)", ratio: 2 / 3 },
	"poster-3-4": { label: "Poster (3:4, comic/game)", ratio: 3 / 4 },
	"banner-16-9": { label: "Banner (16:9)", ratio: 16 / 9 },
	"digest-banner": { label: "Digest banner (30:11)", ratio: 500 / 220 },
	"list-thumbnail-16-9": { label: "List thumbnail (16:9)", ratio: 16 / 9 },
	"avatar-1-1": { label: "Avatar (1:1)", ratio: 1, cropShape: "round" },
};
