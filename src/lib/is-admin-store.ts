import { create } from "zustand";

// Dev stand-in for real auth — always admin for now. Swap the initial
// value (and however it gets set) for a real session check later; nothing
// else needs to change, since components read this instead of taking an
// "am I allowed to edit" prop from their caller.
// toggleAdmin exists only for nav-bar.tsx's temporary dev-only toggle
// button, to preview the site as a non-admin visitor without editing code —
// remove both once real auth lands, since this store won't be a plain
// always-true default to flip anymore.
export const useIsAdminStore = create<{
	isAdmin: boolean;
	toggleAdmin: () => void;
}>((set) => ({
	isAdmin: true,
	toggleAdmin: () => set((s) => ({ isAdmin: !s.isAdmin })),
}));
