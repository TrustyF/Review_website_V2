// Client-safe shape metadata (label + aspect ratio only) — kept separate
// from image-crop-resolver.ts's server-only settings (output dir, quality,
// format) for the same reason posterRatioFor lives apart from
// poster-resolver.ts: a "use client" module can't import anything from a
// module that pulls in fs/sharp, even a plain function or constant, since
// Next treats every export from a client-imported module as client-bundled.
export type CropShapeId =
	| "poster-2-3"
	| "poster-3-4"
	| "banner-16-9"
	| "list-thumbnail-16-9"
	| "avatar-1-1";

export const CROP_SHAPES: Record<
	CropShapeId,
	{
		label: string;
		ratio: number;
		// Cropper's own overlay guide only — "round" just draws a circular mask
		// over the crop rect so it's obvious the corners get cropped away by
		// the consuming UI's own border-radius (AvatarPicker's .option_image).
		// The saved file itself always stays a plain rectangular image, same
		// as every other shape here — never one with actual transparent
		// corners.
		cropShape?: "rect" | "round";
	}
> = {
	"poster-2-3": { label: "Poster (2:3)", ratio: 2 / 3 },
	"poster-3-4": { label: "Poster (3:4, comic/game)", ratio: 3 / 4 },
	"banner-16-9": { label: "Banner (16:9)", ratio: 16 / 9 },
	"list-thumbnail-16-9": { label: "List thumbnail (16:9)", ratio: 16 / 9 },
	"avatar-1-1": { label: "Avatar (1:1)", ratio: 1, cropShape: "round" },
};
