import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";

// See the person-credits page's own comment — same gap (no revalidatePath
// wired up anywhere for this route, credits recreated both from an
// in-app Server Action and from the out-of-process enrich-db.ts cron),
// same fix.
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
