// Split out from compression-actions.ts: a "use server" file may only export
// async functions (each export becomes a Server Action reference) — a type
// export alongside them breaks Turbopack's build for the whole route.
export type CompressionFormat = "webp" | "avif" | "jpeg";

export type CompressionResult = {
	sizeBytes: number;
	dataUrl: string;
};

export type DenoiseMethod = "median" | "blur";
