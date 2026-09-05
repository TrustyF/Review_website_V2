import { create } from "zustand";
import { MediaRecord } from "@/components/media/types";

// Holds full record so editor renders preview immediately on open.
export const useReviewEditorStore = create<{
	media: MediaRecord | null;
	open: (media: MediaRecord) => void;
	close: () => void;
}>((set) => ({
	media: null,
	open: (media) => set({ media }),
	close: () => set({ media: null }),
}));
