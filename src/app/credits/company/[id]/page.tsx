import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/credit-media-list-page/credit-media-list-page";

export default async function CompanyCreditsPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ role?: string }>;
}) {
	const { id } = await params;
	const { role } = await searchParams;
	const companyId = Number(id);
	if (!Number.isFinite(companyId)) notFound();

	return (
		<CreditMediaListPage
			kind="company"
			id={companyId}
			role={role}
		/>
	);
}
