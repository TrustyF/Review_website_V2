import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";

export default async function PersonCreditsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const personId = Number(id);
	if (!Number.isFinite(personId)) notFound();

	return <CreditMediaListPage kind="person" id={personId} />;
}
