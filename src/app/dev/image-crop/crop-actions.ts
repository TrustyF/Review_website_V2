"use server";
import { saveCroppedImage } from "@/server/resolvers/image-crop-resolver";
import { CROP_SHAPES, CropShapeId } from "@/app/dev/image-crop/crop-shapes";

// No auth check here, same as every other mutation in this app (addMediaToList,
// updateMediaBannerFocus, deleteList, ...) — isAdmin (see is-admin-store.ts)
// is a client-only stand-in for real auth, with nothing server-side to check
// yet. That comment's own note applies here too: swap for a real session
// check later and nothing else needs to change.
export async function saveCroppedImageAction(formData: FormData): Promise<string> {
	const file = formData.get("file");
	if (!(file instanceof File)) throw new Error("No file provided");

	const shapeId = formData.get("shapeId");
	if (typeof shapeId !== "string" || !(shapeId in CROP_SHAPES)) {
		throw new Error("Invalid shape");
	}

	const crop = JSON.parse(String(formData.get("crop")));
	if (
		typeof crop?.x !== "number" ||
		typeof crop?.y !== "number" ||
		typeof crop?.width !== "number" ||
		typeof crop?.height !== "number"
	) {
		throw new Error("Invalid crop rect");
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveCroppedImage(bytes, shapeId as CropShapeId, crop);
}
