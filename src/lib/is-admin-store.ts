import { create } from "zustand";

// Dev stand-in for real auth — always admin for now. Swap the initial
// value (and however it gets set) for a real session check later; nothing
// else needs to change, since components read this instead of taking an
// "am I allowed to edit" prop from their caller.
export const useIsAdminStore = create<{ isAdmin: boolean }>(() => ({
	isAdmin: true,
}));
