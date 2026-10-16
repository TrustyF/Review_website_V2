// Client-safe shape metadata; separate from server-only since
// "use client" can't import fs/sharp.
export type CropShapeId =
	| "freeform"
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
		// null = freeform: the tool picks the ratio (the image's own by default, i.e. full size).
		ratio: number | null;
		// UI guide only — draws a circular mask hinting at the consumer's own
		// border-radius crop; the saved file always stays a plain rectangle.
		cropShape?: "rect" | "round";
	}
> = {
	freeform: { label: "Freeform (full size)", ratio: null },
	"poster-2-3": { label: "Poster (2:3)", ratio: 2 / 3 },
	"poster-3-4": { label: "Poster (3:4, comic/game)", ratio: 3 / 4 },
	"banner-16-9": { label: "Banner (16:9)", ratio: 16 / 9 },
	"digest-banner": { label: "Digest banner (30:11)", ratio: 500 / 220 },
	"list-thumbnail-16-9": { label: "List thumbnail (16:9)", ratio: 16 / 9 },
	"avatar-1-1": { label: "Avatar (1:1)", ratio: 1, cropShape: "round" },
};

// Above this a saved image gets a storage warning (crop tool, review Image button).
export const HEAVY_IMAGE_BYTES = 20 * 1024;

export function formatBytes(bytes: number): string {
	return bytes >= 1024 * 1024
		? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
		: `${Math.round(bytes / 1024)} KB`;
}

// Bounds for the optional resize step's output width.
export const MIN_OUTPUT_WIDTH = 16;
export const MAX_OUTPUT_WIDTH = 4000;
