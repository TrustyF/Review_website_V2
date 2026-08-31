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
	// Smoothing grain before encoding often beats just lowering quality. "median"
	// = sharp's edge-preserving filter (amount = odd kernel px, 1 = off); "blur"
	// = gaussian (amount = sigma, 0 = off), softer on edges but kills grain harder.
	denoiseMethod?: DenoiseMethod;
	denoiseAmount?: number;
};

// Re-encodes the source in memory only (data URL, not a saved file) so trying
// many combinations leaves no cache residue and can't be mistaken for something
// already committed. No re-noise step: grain is added back via a free CSS
// overlay instead of baking bytes into the file (see .grain_overlay).
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
