import { notFound } from "next/navigation";
import { CountryMediaListPage } from "@/components/media/media-pages/country-media-list-page/country-media-list-page";
import { generateCountryMetadata } from "./metadata";

export const generateMetadata = generateCountryMetadata;

export default async function CountryPage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code } = await params;
	if (!/^[a-zA-Z]{2}$/.test(code)) notFound();

	return <CountryMediaListPage code={code} />;
}
