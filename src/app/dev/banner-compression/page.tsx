import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import {
	bannerUrlFor,
	BANNER_MAX_WIDTH,
	BANNER_WEBP_QUALITY,
} from "@/server/resolvers/poster-resolver";
import { CompressionPlayground } from "./compression-playground";

// Random-ish sample of real banners to try compression settings against,
// rather than needing to hunt down and paste a URL for every test — a
// "Custom URL…" option in the playground still covers anything not in here.
const SAMPLE_SIZE = 30;

export default async function BannerCompressionDevPage() {
	if (process.env.NODE_ENV !== "development") notFound();

	const candidates = await db.media.findMany({
		where: { bannerPath: { not: null } },
		select: { id: true, title: true, type: true, bannerPath: true },
		orderBy: { id: "desc" },
		take: SAMPLE_SIZE,
	});

	const banners = candidates.map((media) => ({
		id: media.id,
		title: media.title,
		// bannerUrlFor's own source URL (TMDB w1280 / IGDB t_1080p) — the same
		// un-cached, un-resized input resolveBanner itself downloads before
		// re-encoding, so what this measures matches what production would
		// actually start from.
		sourceUrl: bannerUrlFor(media.type, media.bannerPath!),
	}));

	return (
		<CompressionPlayground
			banners={banners}
			productionSettings={{
				format: "webp",
				quality: BANNER_WEBP_QUALITY,
				width: BANNER_MAX_WIDTH,
			}}
		/>
	);
}
