"use client";
import { useState } from "react";
import { removeMediaFromList } from "@/components/lists/list-actions";

// Shared by RankedList and ListMediaView: removes one item and tracks which one's mid-removal so its button can disable itself.
export function useListItemRemoval(listId: number) {
	const [removingId, setRemovingId] = useState<number | null>(null);

	async function handleRemove(mediaId: number) {
		setRemovingId(mediaId);
		try {
			await removeMediaFromList(listId, mediaId);
		} finally {
			setRemovingId(null);
		}
	}

	return { removingId, handleRemove };
}
