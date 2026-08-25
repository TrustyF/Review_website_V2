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
	// Applied before encoding — grain is high-frequency detail a lossy encoder
	// spends disproportionate bits preserving relative to how much it
	// actually reads as "quality" at this display size, so smoothing it out
	// before compressing is often a much better size/quality trade than just
	// lowering quality further. "median" is sharp's own edge-preserving order
	// filter (denoiseAmount = odd kernel size in px, 1 = off); "blur" is a
	// plain gaussian blur (denoiseAmount = sigma, 0 = off) — softer on edges
	// but often kills grain more thoroughly for the same size cost. Sharp/
	// libvips doesn't expose a true edge-aware denoiser (bilateral, non-local
	// means) — those live in ffmpeg/OpenCV, too heavy a dependency to add
	// just for this comparison.
	denoiseMethod?: DenoiseMethod;
	denoiseAmount?: number;
};

// Downloads the source once and re-encodes it with whatever
// format/quality/width/denoise the playground is currently trying — nothing
// gets written to disk, nothing goes through mediaAssetFilename's
// content-addressed cache, so trying a dozen combinations leaves no residue
// for poster-cleanup.ts to worry about later. The result is a data URL
// rather than a saved file specifically so a "preview" can never be mistaken
// for something already committed.
//
// No re-noise step here (there used to be one, compositing synthetic grain
// back onto the pixels before encoding) — baking grain into the file costs
// real bytes, the same ones denoising just saved. A static image has no
// decode-time grain-synthesis channel the way AV1 video does, but the same
// idea still works via plain CSS: an SVG feTurbulence overlay rendered by
// the browser on top of the <img> costs zero image bytes, since it's never
// part of the file at all. See compression-playground.tsx's .grain_overlay.
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

// The "before" number the comparison percentages are relative to — the
// source's own byte size, untouched.
export async function getOriginalSize(sourceUrl: string): Promise<number> {
	await requireAdmin();

	const res = await fetch(sourceUrl);
	if (!res.ok) throw new Error("Failed to fetch source image");
	const bytes = Buffer.from(await res.arrayBuffer());
	return bytes.byteLength;
}
