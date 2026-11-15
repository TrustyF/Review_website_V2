import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";
import { creditRobots } from "@/components/media/media-pages/credit-media-list-page/credit-robots";

// Nothing calls revalidatePath for this route (credits also get resynced by the out-of-process enrich-db.ts cron), so a time-based revalidate keeps filmographies from going stale forever.
export const revalidate = 3600;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const id = Number((await params).id);
	if (!Number.isFinite(id)) return {};
	const [entity, robots] = await Promise.all([
		db.person.findUnique({ where: { id }, select: { name: true } }),
		creditRobots("person", id),
	]);
	return entity ? { title: entity.name, robots } : {};
}

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
