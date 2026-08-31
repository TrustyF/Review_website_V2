// Split out: a "use server" file may only export async functions; a type export alongside breaks the build.
export type CompressionFormat = "webp" | "avif" | "jpeg";

export type CompressionResult = {
	sizeBytes: number;
	dataUrl: string;
};

export type DenoiseMethod = "median" | "blur";
