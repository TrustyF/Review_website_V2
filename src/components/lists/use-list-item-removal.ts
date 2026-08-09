"use client";
import { useState } from "react";
import { removeMediaFromList } from "@/components/lists/list-actions";

// Shared by RankedList and ListMediaView — same "remove one item, track
// which one's mid-removal so its own button can disable itself" logic
// either way, regardless of how the list is currently sorted.
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
