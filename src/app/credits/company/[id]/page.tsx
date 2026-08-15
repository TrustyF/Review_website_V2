import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";

export default async function CompanyCreditsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const companyId = Number(id);
	if (!Number.isFinite(companyId)) notFound();

	return <CreditMediaListPage kind="company" id={companyId} />;
}
