import type { MetadataRoute } from "next";
import { dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
import { SITE_URL } from "@/lib/site-url";

// Static, publicly-browsable routes — excludes auth/account/admin/dev pages.
const STATIC_ROUTES = [
	"",
	"/movies",
	"/tv",
	"/shorts",
	"/books",
	"/comics",
	"/games",
	"/manga",
	"/reviews",
	"/stats",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const [media, genres, countries] = await Promise.all([
		dbPublic.media.findMany({
			where: { enrichmentStatus: EnrichmentStatus.DONE, isAdult: false },
			select: { id: true, updateDate: true, createDate: true },
		}),
		// distinct: a genre name can span multiple rows (see genre-media-list-page.tsx's own comment).
		dbPublic.genre.findMany({ distinct: ["name"], select: { name: true } }),
		dbPublic.media.findMany({
			where: {
				enrichmentStatus: EnrichmentStatus.DONE,
				isAdult: false,
				countryId: { not: null },
			},
			distinct: ["countryId"],
			select: { originCountry: { select: { countryCode2: true } } },
		}),
	]);

	return [
		...STATIC_ROUTES.map((route) => ({
			url: `${SITE_URL}${route}`,
			lastModified: new Date(),
		})),
		...genres.map((genre) => ({
			url: `${SITE_URL}/genre/${encodeURIComponent(genre.name)}`,
			lastModified: new Date(),
		})),
		...countries
			.map((c) => c.originCountry?.countryCode2)
			.filter((code) => code != null)
			.map((code) => ({
				url: `${SITE_URL}/country/${code.toLowerCase()}`,
				lastModified: new Date(),
			})),
		...media.map((item) => ({
			url: `${SITE_URL}/media/${item.id}`,
			lastModified: item.updateDate ?? item.createDate ?? new Date(),
		})),
	];
}
