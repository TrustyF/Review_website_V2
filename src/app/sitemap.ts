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
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const media = await dbPublic.media.findMany({
		where: { enrichmentStatus: EnrichmentStatus.DONE, isAdult: false },
		select: { id: true, updateDate: true, createDate: true },
	});

	return [
		...STATIC_ROUTES.map((route) => ({
			url: `${SITE_URL}${route}`,
			lastModified: new Date(),
		})),
		...media.map((item) => ({
			url: `${SITE_URL}/media/${item.id}`,
			lastModified: item.updateDate ?? item.createDate ?? new Date(),
		})),
	];
}
