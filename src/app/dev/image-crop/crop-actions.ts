"use server";
import {
	type SavedCrop,
	saveCroppedImage,
} from "@/server/resolvers/image-crop-resolver";
import {
	CROP_SHAPES,
	CropShapeId,
	MAX_OUTPUT_WIDTH,
	MIN_OUTPUT_WIDTH,
} from "@/app/dev/image-crop/crop-shapes";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function saveCroppedImageAction(
	formData: FormData,
): Promise<SavedCrop> {
	await requireAdmin();

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

	// Absent/empty = no resize step, the shape's own size applies
	const rawOutputWidth = formData.get("outputWidth");
	let outputWidth: number | undefined;
	if (typeof rawOutputWidth === "string" && rawOutputWidth !== "") {
		outputWidth = Number(rawOutputWidth);
		if (
			!Number.isInteger(outputWidth) ||
			outputWidth < MIN_OUTPUT_WIDTH ||
			outputWidth > MAX_OUTPUT_WIDTH
		) {
			throw new Error("Invalid output width");
		}
	}

	// Absent/empty = the shape's own quality
	const rawQuality = formData.get("quality");
	let quality: number | undefined;
	if (typeof rawQuality === "string" && rawQuality !== "") {
		quality = Number(rawQuality);
		if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
			throw new Error("Invalid quality");
		}
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveCroppedImage(bytes, shapeId as CropShapeId, crop, {
		...(outputWidth !== undefined ? { width: outputWidth } : {}),
		...(quality !== undefined ? { quality } : {}),
	});
}

// Server-side fetch (arbitrary host won't send CORS headers). Returned as data URL so client can turn it straight into File.
export async function fetchImportedImage(url: string): Promise<string> {
	await requireAdmin();

	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to fetch image");

	const bytes = Buffer.from(await res.arrayBuffer());
	const contentType = res.headers.get("content-type") ?? "image/jpeg";
	return `data:${contentType};base64,${bytes.toString("base64")}`;
}
