import { ChevronRight } from "lucide-react";
import { Link } from "@/components/ui/link";
import { getLocale } from "@/lib/i18n/get-locale";
import {
	collectionHref,
	getMediaCollection,
	localizedCollectionName,
} from "@/components/collections/collection-media";
import { CollectionGrid } from "@/components/collections/collection-grid";
import styles from "./media-detail.module.sass";

export async function MediaCollectionSection({ mediaId }: { mediaId: number }) {
	const [collection, locale] = await Promise.all([
		getMediaCollection(mediaId),
		getLocale(),
	]);
	if (!collection) return null;
	return (
		<section className={styles.section}>
			<h2 className={styles.section_title}>
				<Link
					href={collectionHref(collection.id)}
					className={styles.section_title_link}>
					{localizedCollectionName(collection, locale)}
					<ChevronRight size={18} />
				</Link>
			</h2>
			<CollectionGrid items={collection.items} compact currentId={mediaId} />
		</section>
	);
}
