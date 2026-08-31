"use server";
import { saveCroppedImage } from "@/server/resolvers/image-crop-resolver";
import { CROP_SHAPES, CropShapeId } from "@/app/dev/image-crop/crop-shapes";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dbPublic } from "@/server/db/client";
import { bannerUrlFor, toPosterSrc } from "@/server/resolvers/asset-paths";
import { fuzzySearch } from "@/lib/fuzzy-search";

export async function saveCroppedImageAction(formData: FormData): Promise<string> {
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

	// Absent on older callers — defaults to 0 (no vignette) rather than rejecting
	const rawVignette = formData.get("vignette");
	const vignette =
		typeof rawVignette === "string" && rawVignette !== "" ? Number(rawVignette) : 0;
	if (!Number.isFinite(vignette) || vignette < 0 || vignette > 1) {
		throw new Error("Invalid vignette");
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveCroppedImage(bytes, shapeId as CropShapeId, crop, vignette);
}

// Server-side fetch since an arbitrary host won't reliably send CORS headers a
// browser fetch needs. Returned as a data URL so the client can turn it
// straight into a File with no CORS concern.
export async function fetchImportedImage(url: string): Promise<string> {
	await requireAdmin();

	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to fetch image");

	const bytes = Buffer.from(await res.arrayBuffer());
	const contentType = res.headers.get("content-type") ?? "image/jpeg";
	return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export type BannerSearchResult = {
	id: number;
	title: string;
	// Thumbnail for the results list only — bannerSrc is the actual crop source
	posterSrc: string;
	// Absolute TMDB/IGDB URL, not this app's /api/banner route — fetchImportedImage's
	// raw server-side fetch() can't resolve a relative path
	bannerSrc: string;
};

const BANNER_SEARCH_LIMIT = 20;

// Same typo tolerance as list-actions.ts's searchMediaForList
const BANNER_FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Backs "search a movie/show for its banner" — loads every eligible
// candidate and ranks in memory, same tradeoff as searchMediaForList.
export async function searchMediaForBanner(
	query: string,
): Promise<BannerSearchResult[]> {
	await requireAdmin();
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: { bannerPath: { not: null } },
		select: { id: true, title: true, type: true, posterPath: true, bannerPath: true },
		orderBy: { id: "asc" },
	});

	return fuzzySearch(candidates, BANNER_FUSE_OPTIONS, trimmed, BANNER_SEARCH_LIMIT).map(
		(m) => ({
			id: m.id,
			title: m.title,
			posterSrc: toPosterSrc(m.id, m.posterPath),
			// Non-null guaranteed by the where clause; Prisma's select type just doesn't narrow it
			bannerSrc: bannerUrlFor(m.type, m.bannerPath!),
		}),
	);
}
