import type { Metadata } from "next";
import { getCollection } from "@/components/collections/collection-media";

export async function generateCollectionMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const collectionId = Number(id);
	if (!Number.isInteger(collectionId)) return {};
	const collection = await getCollection(collectionId);
	if (!collection) return {};

	return {
		title: collection.name,
		description: `Arthur Sirjacobs' reviews of the ${collection.name}, in watch order.`,
		alternates: { canonical: `/collection/${collection.id}` },
	};
}
