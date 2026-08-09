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
	| "list-thumbnail-16-9";

export const CROP_SHAPES: Record<CropShapeId, { label: string; ratio: number }> = {
	"poster-2-3": { label: "Poster (2:3)", ratio: 2 / 3 },
	"poster-3-4": { label: "Poster (3:4, comic/game)", ratio: 3 / 4 },
	"banner-16-9": { label: "Banner (16:9)", ratio: 16 / 9 },
	"list-thumbnail-16-9": { label: "List thumbnail (16:9)", ratio: 16 / 9 },
};
