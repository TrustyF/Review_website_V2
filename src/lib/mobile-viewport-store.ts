import { create } from "zustand";

// Kept in sync by hand with $mobile-breakpoint in
// src/app/styles/variables.sass — same "JS constant mirrors a sass value"
// precedent as CARD_TRANSITION_MS in featured-review.tsx.
export const MOBILE_BREAKPOINT_PX = 700;

export const useMobileViewportStore = create<{
	isMobile: boolean;
	setIsMobile: (isMobile: boolean) => void;
}>((set) => ({
	isMobile: false,
	setIsMobile: (isMobile) => set({ isMobile }),
}));
