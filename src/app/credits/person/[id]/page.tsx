import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/credit-media-list-page/credit-media-list-page";

export default async function PersonCreditsPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ role?: string }>;
}) {
	const { id } = await params;
	const { role } = await searchParams;
	const personId = Number(id);
	if (!Number.isFinite(personId)) notFound();

	return (
		<CreditMediaListPage
			kind="person"
			id={personId}
			role={role}
		/>
	);
}
