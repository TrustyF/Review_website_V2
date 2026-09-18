import type { Metadata } from "next";
import { COUNTRY_NAME_BY_CODE } from "@/components/media/media-pages/country-media-list-page/country-media-list-page";

export async function generateCountryMetadata({
	params,
}: {
	params: Promise<{ code: string }>;
}): Promise<Metadata> {
	const { code } = await params;
	const upperCode = code.toUpperCase();
	const name = COUNTRY_NAME_BY_CODE.get(upperCode);
	if (!name) return {};

	return {
		title: `${name} Reviews`,
		description: `Arthur Sirjacobs' reviews of movies, TV shows, books, comics, manga and games from ${name}.`,
		alternates: { canonical: `/country/${code.toLowerCase()}` },
	};
}
