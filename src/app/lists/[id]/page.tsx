import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { ListDetailPage } from "@/components/lists/list-detail-page/list-detail-page";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const listId = Number((await params).id);
	if (!Number.isFinite(listId)) return {};
	const list = await db.list.findUnique({
		where: { id: listId },
		select: { title: true, titleFr: true, targetUserId: true },
	});
	if (!list) return {};
	// Same visibility rule as ListDetailPage, so a recommendation list's title can't leak.
	if (list.targetUserId) {
		const session = await auth();
		if (
			session?.user?.id !== list.targetUserId &&
			session?.user?.role !== "ADMIN"
		)
			return {};
	}
	const locale = await getLocale();
	return { title: locale === "fr" ? (list.titleFr ?? list.title) : list.title };
}

export default async function ListPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const listId = Number(id);
	if (!Number.isFinite(listId)) notFound();

	return <ListDetailPage id={listId} />;
}
