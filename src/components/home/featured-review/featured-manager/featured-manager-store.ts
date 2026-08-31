import { create } from "zustand";

// Trivial open/close store — no record to hold, since this manages the global featured set, not one media item.
export const useFeaturedManagerStore = create<{
	isOpen: boolean;
	open: () => void;
	close: () => void;
}>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
}));
