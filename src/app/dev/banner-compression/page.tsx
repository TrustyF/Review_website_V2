import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import {
	bannerUrlFor,
	posterUrlFor,
	personPhotoUrlFor,
	BANNER_FORMAT,
	BANNER_GRAIN_OPACITY,
	BANNER_MAX_WIDTH,
	BANNER_QUALITY,
	POSTER_QUALITY,
	PERSON_PHOTO_MAX_WIDTH,
	PERSON_PHOTO_QUALITY,
} from "@/server/resolvers/poster-resolver";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { CompressionPlayground } from "./compression-playground";

// Random-ish sample of real banners/posters to try compression settings
// against, rather than needing to hunt down and paste a URL for every test —
// a "Custom URL…" option in the playground still covers anything not in
// here.
const SAMPLE_SIZE = 30;
// Posters aren't resized by resolvePoster at all (source dimensions kept as
// on-disk asset actually is: 500px for TMDB, 512px for MangaDex,
// ~264px for IGDB's t_cover_big) — this is just a reasonable starting point
// for the playground's own width slider, not a cap production applies.
const POSTER_PLAYGROUND_WIDTH = 500;

export default async function BannerCompressionDevPage() {
	if (process.env.NODE_ENV !== "development") notFound();

	const [bannerCandidates, posterCandidates, personCandidates] =
		await Promise.all([
			db.media.findMany({
				where: { bannerPath: { not: null } },
				select: { id: true, title: true, type: true, bannerPath: true },
				orderBy: { id: "desc" },
				take: SAMPLE_SIZE,
			}),
			db.media.findMany({
				where: { posterPath: { not: null } },
				select: {
					id: true,
					title: true,
					type: true,
					externalId: true,
					posterPath: true,
				},
				orderBy: { id: "desc" },
				take: SAMPLE_SIZE,
			}),
			db.person.findMany({
				where: { photoPath: { not: null } },
				select: { id: true, name: true, photoPath: true },
				orderBy: { id: "desc" },
				take: SAMPLE_SIZE,
			}),
		]);

	const banners = bannerCandidates.map((media) => ({
		id: media.id,
		title: media.title,
		// bannerUrlFor's own source URL (TMDB w1280 / IGDB t_1080p) — the same
		// un-cached, un-resized input resolveBanner itself downloads before
		// re-encoding, so what this measures matches what production would
		// actually start from.
		sourceUrl: bannerUrlFor(media.type, media.bannerPath!),
	}));

	const posters = posterCandidates.map((media) => ({
		id: media.id,
		title: media.title,
		// Same reasoning as banners' sourceUrl — posterUrlFor's "full" size is
		// exactly what resolvePoster itself downloads before re-encoding.
		sourceUrl: posterUrlFor(media.type, media.externalId, media.posterPath!, "full"),
		// Same aspect ratio MediaPoster itself renders at (see poster-ratio.ts)
		// — the practical-scale previews need this to size their frame the
		// same way the grid card/detail page actually would, not just guess
		// 2/3 for every type.
		ratio: posterRatioFor(media.type),
	}));

	const people = personCandidates.map((person) => ({
		id: person.id,
		title: person.name,
		// Same reasoning as banners/posters' sourceUrl — personPhotoUrlFor's
		// w185 is exactly what resolvePersonPhoto itself downloads before
		// re-encoding.
		sourceUrl: personPhotoUrlFor(person.photoPath!),
	}));

	return (
		<CompressionPlayground
			banners={banners}
			posters={posters}
			people={people}
			bannerSettings={{
				format: BANNER_FORMAT,
				quality: BANNER_QUALITY,
				width: BANNER_MAX_WIDTH,
				grainOpacity: BANNER_GRAIN_OPACITY,
			}}
			posterSettings={{
				format: "webp",
				quality: POSTER_QUALITY,
				width: POSTER_PLAYGROUND_WIDTH,
				// Production never overlays grain on posters — only banners (see
				// BannerEditTrigger's .grain) — 0 keeps the playground's default
				// an honest reflection of that.
				grainOpacity: 0,
			}}
			personSettings={{
				format: "webp",
				quality: PERSON_PHOTO_QUALITY,
				width: PERSON_PHOTO_MAX_WIDTH,
				// Same reasoning as posters — production never overlays grain on
				// cast photos either.
				grainOpacity: 0,
			}}
		/>
	);
}
