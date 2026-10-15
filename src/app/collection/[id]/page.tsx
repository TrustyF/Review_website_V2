import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLocale } from "@/lib/i18n/get-locale";
import {
	getCollection,
	localizedCollectionName,
} from "@/components/collections/collection-media";
import { CollectionGrid } from "@/components/collections/collection-grid";
import { generateCollectionMetadata } from "./metadata";
import styles from "./collection-page.module.sass";

export const generateMetadata = generateCollectionMetadata;

// A TMDB movie collection (franchise) in watch order, reached from a member's media page.
export default async function CollectionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const collectionId = Number(id);
	if (!Number.isInteger(collectionId)) notFound();

	const [collection, dict, locale] = await Promise.all([
		getCollection(collectionId),
		getDictionary(),
		getLocale(),
	]);
	if (!collection || collection.items.length === 0) notFound();

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					{localizedCollectionName(collection, locale)}
				</h1>
				<span className={styles.count}>
					{dict.mediaDetail.collectionWatchOrder} ·{" "}
					{dict.stats.titleCount(collection.items.length)}
				</span>
			</div>
			<CollectionGrid items={collection.items} />
		</div>
	);
}
