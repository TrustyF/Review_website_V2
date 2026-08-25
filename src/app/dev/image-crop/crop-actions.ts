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

	// Absent on any caller predating this field — defaults to 0 (no vignette)
	// rather than rejecting, same as an absent checkbox field would.
	const rawVignette = formData.get("vignette");
	const vignette =
		typeof rawVignette === "string" && rawVignette !== "" ? Number(rawVignette) : 0;
	if (!Number.isFinite(vignette) || vignette < 0 || vignette > 1) {
		throw new Error("Invalid vignette");
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	return saveCroppedImage(bytes, shapeId as CropShapeId, crop, vignette);
}

// Loads a source image from an arbitrary URL instead of a local file pick —
// has to happen server-side (same as compression-actions.ts's
// compressPreview/getOriginalSize) since an arbitrary host won't reliably
// send the CORS headers a browser fetch would need. Returned as a data URL
// rather than raw bytes so the client can turn it straight into a File
// (`fetch(dataUrl)` is same-origin, no CORS concern) and feed it through the
// exact same path a locally-picked file already takes.
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
	// Small recognizable thumbnail for the results list, not the crop source
	// itself — bannerSrc below is what actually gets fed into
	// fetchImportedImage once picked.
	posterSrc: string;
	// The banner's real TMDB/IGDB source URL (via bannerUrlFor), not this
	// app's own /api/banner route — fetchImportedImage does a raw
	// server-side fetch(), and a relative /api/banner/... path wouldn't
	// resolve there the way an absolute source URL does.
	bannerSrc: string;
};

const BANNER_SEARCH_LIMIT = 20;

// Same typo tolerance as list-actions.ts's searchMediaForList — see that
// file's own comment on threshold/ignoreLocation.
const BANNER_FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

// Backs the crop tool's "search a movie/show for its banner" flow — lets an
// admin load an existing title's banner as the crop source instead of only
// a local file or a pasted URL. bannerPath: { not: null } excludes most of
// the catalog up front (see asset-paths.ts's bannerUrlFor comment: only
// TMDB/IGDB-sourced media ever has one), same "load every eligible
// candidate, rank in memory" tradeoff searchMediaForList makes.
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
			// bannerPath can't actually be null here — the where clause above
			// guarantees it — but Prisma's generated select type doesn't narrow
			// on that, so bannerUrlFor's non-nullable param still needs telling.
			bannerSrc: bannerUrlFor(m.type, m.bannerPath!),
		}),
	);
}
