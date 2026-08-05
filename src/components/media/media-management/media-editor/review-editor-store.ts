import { create } from "zustand";
import { MediaRecord } from "@/components/media/types";

// Holds the full record (not just an id) so the editor can render its
// preview immediately on open instead of waiting on a redundant refetch —
// the card that opened it already has this exact data in hand.
export const useReviewEditorStore = create<{
	media: MediaRecord | null;
	open: (media: MediaRecord) => void;
	close: () => void;
}>((set) => ({
	media: null,
	open: (media) => set({ media }),
	close: () => set({ media: null }),
}));
