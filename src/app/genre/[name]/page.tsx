import { notFound } from "next/navigation";
import { GenreMediaListPage } from "@/components/media/media-pages/genre-media-list-page/genre-media-list-page";

export default async function GenrePage({
	params,
}: {
	params: Promise<{ name: string }>;
}) {
	const { name } = await params;
	const decoded = decodeURIComponent(name);
	if (!decoded) notFound();

	return <GenreMediaListPage name={decoded} />;
}
