"use server";
import sharp, { Sharp } from "sharp";
import {
	CompressionFormat,
	CompressionResult,
	DenoiseMethod,
} from "./compression-types";
import { requireAdmin } from "@/lib/auth/require-admin";

function encode(image: Sharp, format: CompressionFormat, quality: number) {
	switch (format) {
		case "webp":
			return image.webp({ quality });
		case "avif":
			return image.avif({ quality });
		case "jpeg":
			return image.jpeg({ quality });
	}
}

export type CompressOptions = {
	format: CompressionFormat;
	quality: number;
	width: number;
	// Denoise before encoding: "median" (edge-preserving), "blur" (gaussian, softer)
	denoiseMethod?: DenoiseMethod;
	denoiseAmount?: number;
};

// Re-encodes in memory (data URL) so no cache residue from trying combinations. Grain added via CSS overlay instead of baking bytes.
export async function compressPreview(
	sourceUrl: string,
	options: CompressOptions,
): Promise<CompressionResult> {
	await requireAdmin();

	const res = await fetch(sourceUrl);
	if (!res.ok) throw new Error("Failed to fetch source image");
	const bytes = Buffer.from(await res.arrayBuffer());

	let pipeline = sharp(bytes).resize({
		width: options.width,
		withoutEnlargement: true,
	});
	if (options.denoiseMethod === "median" && (options.denoiseAmount ?? 1) > 1) {
		pipeline = pipeline.median(options.denoiseAmount);
	} else if (
		options.denoiseMethod === "blur" &&
		(options.denoiseAmount ?? 0) > 0
	) {
		pipeline = pipeline.blur(options.denoiseAmount);
	}

	const output = await encode(
		pipeline,
		options.format,
		options.quality,
	).toBuffer();

	return {
		sizeBytes: output.length,
		dataUrl: `data:image/${options.format};base64,${output.toString("base64")}`,
	};
}

// The untouched "before" size the comparison percentages are relative to.
export async function getOriginalSize(sourceUrl: string): Promise<number> {
	await requireAdmin();

	const res = await fetch(sourceUrl);
	if (!res.ok) throw new Error("Failed to fetch source image");
	const bytes = Buffer.from(await res.arrayBuffer());
	return bytes.byteLength;
}
