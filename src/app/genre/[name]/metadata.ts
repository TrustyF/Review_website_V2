import type { Metadata } from "next";

export async function generateGenreMetadata({
	params,
}: {
	params: Promise<{ name: string }>;
}): Promise<Metadata> {
	const { name } = await params;
	const decoded = decodeURIComponent(name);
	if (!decoded) return {};

	return {
		title: `${decoded} Reviews`,
		description: `Arthur Sirjacobs' ${decoded.toLowerCase()} movie, TV, book, comic, manga and game reviews.`,
		alternates: { canonical: `/genre/${encodeURIComponent(decoded)}` },
	};
}
