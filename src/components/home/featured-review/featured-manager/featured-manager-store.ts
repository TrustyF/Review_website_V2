import { create } from "zustand";

// Same trivial open/close shape as review-editor-store.ts, but with no
// record to hold — this modal manages the global featured set, not one
// specific media, so there's nothing to seed it with on open.
export const useFeaturedManagerStore = create<{
	isOpen: boolean;
	open: () => void;
	close: () => void;
}>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
}));
