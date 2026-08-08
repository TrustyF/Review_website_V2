import { notFound } from "next/navigation";
import { ListDetailPage } from "@/components/lists/list-detail-page/list-detail-page";

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
