import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";
import { creditRobots } from "@/components/media/media-pages/credit-media-list-page/credit-robots";

// Same revalidatePath gap and fix as the person-credits page.
export const revalidate = 3600;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const id = Number((await params).id);
	if (!Number.isFinite(id)) return {};
	const [entity, robots] = await Promise.all([
		db.company.findUnique({ where: { id }, select: { name: true } }),
		creditRobots("company", id),
	]);
	return entity ? { title: entity.name, robots } : {};
}

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
