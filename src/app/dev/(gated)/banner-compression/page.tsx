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

// Sample of real banners/posters to try settings against ("Custom URL…" covers the rest)
const SAMPLE_SIZE = 30;
// resolvePoster never resizes; this is just a reasonable playground slider starting point
const POSTER_PLAYGROUND_WIDTH = 500;

export default async function BannerCompressionDevPage() {
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
		// Same un-cached, un-resized source resolveBanner itself downloads before re-encoding
		sourceUrl: bannerUrlFor(media.type, media.bannerPath!),
	}));

	const posters = posterCandidates.map((media) => ({
		id: media.id,
		title: media.title,
		// Same "full" size resolvePoster itself downloads before re-encoding
		sourceUrl: posterUrlFor(media.type, media.externalId, media.posterPath!, "full"),
		// Same aspect ratio MediaPoster renders at, so practical-scale previews size correctly
		ratio: posterRatioFor(media.type),
	}));

	const people = personCandidates.map((person) => ({
		id: person.id,
		title: person.name,
		// Same w185 source resolvePersonPhoto itself downloads before re-encoding
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
				// Production never overlays grain on posters, only banners
				grainOpacity: 0,
			}}
			personSettings={{
				format: "webp",
				quality: PERSON_PHOTO_QUALITY,
				width: PERSON_PHOTO_MAX_WIDTH,
				// Same as posters — production never overlays grain on cast photos
				grainOpacity: 0,
			}}
		/>
	);
}
