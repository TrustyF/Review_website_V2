"use client";
import { useState } from "react";
import { addMediaToList } from "@/components/lists/list-actions";
import { MediaBrowser } from "@/components/media/media-browser/media-browser";
import { MediaBrowserSearchResult } from "@/components/media/media-browser/media-browser-actions";
import { Clickable } from "@/components/ui/clickable";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import styles from "./add-media-to-list.module.sass";

type Props = {
	listId: number;
	// Already-on-this-list media ids, so the browser doesn't offer duplicates.
	excludeMediaIds: number[];
	// Read-only "already seen" badge for a recommendation list's target user — see SeenBadge.
	seenMediaIds?: Set<number> | undefined;
};

export function AddMediaToList({ listId, excludeMediaIds, seenMediaIds }: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported.
	const isAdmin = sessionIsAdmin && !isMobileViewport;
	const [isBrowserOpen, setIsBrowserOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSelect(result: MediaBrowserSearchResult) {
		setIsBrowserOpen(false);
		try {
			await addMediaToList(listId, result.id);
		} catch {
			setError(`Failed to add "${result.title}". Try again.`);
		}
	}

	if (!isAdmin) return null;

	return (
		<div className={styles.wrapper}>
			<Clickable
				className={styles.browse_button}
				onClick={() => setIsBrowserOpen(true)}>
				Add media…
			</Clickable>
			{error && <div className={styles.error}>{error}</div>}
			{/* Always mounted (visibility toggled via isOpen) so its search state survives being closed and reopened. */}
			<MediaBrowser
				isOpen={isBrowserOpen}
				excludeMediaIds={excludeMediaIds}
				seenMediaIds={seenMediaIds}
				onSelect={handleSelect}
				onClose={() => setIsBrowserOpen(false)}
			/>
		</div>
	);
}
