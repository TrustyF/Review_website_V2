import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";

// Same revalidatePath gap and fix as the person-credits page.
export const revalidate = 3600;

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
