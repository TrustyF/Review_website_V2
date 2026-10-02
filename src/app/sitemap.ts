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

// Keeps the latest date per key — hub pages are as fresh as their newest media.
function bumpLatest(
	map: Map<string, Date | undefined>,
	key: string,
	date: Date | undefined,
) {
	const current = map.get(key);
	if (!map.has(key) || (date && (!current || date > current)))
		map.set(key, date);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const media = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, isAdult: false },
		select: {
			id: true,
			updateDate: true,
			createDate: true,
			originCountry: { select: { countryCode2: true } },
			mediaGenres: { select: { genre: { select: { name: true } } } },
		},
	});

	let latestOverall: Date | undefined;
	const latestByGenre = new Map<string, Date | undefined>();
	const latestByCountry = new Map<string, Date | undefined>();
	const mediaEntries: MetadataRoute.Sitemap = [];

	for (const item of media) {
		const date = item.updateDate ?? item.createDate ?? undefined;
		mediaEntries.push({
			url: `${SITE_URL}/media/${item.id}`,
			lastModified: date,
		});
		if (date && (!latestOverall || date > latestOverall)) latestOverall = date;
		for (const { genre } of item.mediaGenres)
			bumpLatest(latestByGenre, genre.name, date);
		const code = item.originCountry?.countryCode2;
		if (code) bumpLatest(latestByCountry, code.toLowerCase(), date);
	}

	return [
		...STATIC_ROUTES.map((route) => ({
			url: `${SITE_URL}${route}`,
			lastModified: latestOverall,
		})),
		...[...latestByGenre].map(([name, date]) => ({
			url: `${SITE_URL}/genre/${encodeURIComponent(name)}`,
			lastModified: date,
		})),
		...[...latestByCountry].map(([code, date]) => ({
			url: `${SITE_URL}/country/${code}`,
			lastModified: date,
		})),
		...mediaEntries,
	];
}
