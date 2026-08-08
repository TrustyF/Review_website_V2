"use client";
import { useState } from "react";
import { MediaRecord } from "@/components/media/types";
import { MediaMiniCardResolver } from "@/components/media/media-cards/media-mini-card/media-mini-card-resolver";
import { removeMediaFromList } from "@/components/lists/list-actions";
import { useIsAdminStore } from "@/lib/is-admin-store";
import styles from "./list-media-grid.module.sass";

type Props = {
	listId: number;
	media: MediaRecord[];
};

// Plain grid, no infinite scroll/search (unlike LazyMediaGrid/MediaSearchGrid)
// — a curated list is expected to stay small, so mounting every card up
// front is fine. Each card gets an admin-gated "×" overlay to pull it back
// out of the list, a sibling of MediaMiniCardResolver rather than wrapped
// inside it so it isn't clipped by anything the card itself does with
// overflow.
export function ListMediaGrid({ listId, media }: Props) {
	const isAdmin = useIsAdminStore((s) => s.isAdmin);
	const [removingId, setRemovingId] = useState<number | null>(null);

	async function handleRemove(mediaId: number) {
		setRemovingId(mediaId);
		try {
			await removeMediaFromList(listId, mediaId);
		} finally {
			setRemovingId(null);
		}
	}

	return (
		<div className={styles.grid}>
			{media.map((item) => (
				<div className={styles.item} key={item.id}>
					<MediaMiniCardResolver media={item} />
					{isAdmin && (
						<button
							type="button"
							className={styles.remove_button}
							aria-label={`Remove ${item.title} from list`}
							disabled={removingId === item.id}
							onClick={() => handleRemove(item.id)}>
							×
						</button>
					)}
				</div>
			))}
		</div>
	);
}
