import { create } from "zustand";

export const useReviewEditorStore = create<{
	mediaId: number | null;
	open: (id: number) => void;
	close: () => void;
}>((set) => ({
	mediaId: null,
	open: (id) => set({ mediaId: id }),
	close: () => set({ mediaId: null }),
}));
