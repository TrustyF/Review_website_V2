"use client";
import { useMobileViewportStore } from "@/lib/mobile-viewport-store";

// Viewport ≤$mobile-breakpoint via app-wide listener; suppresses mobile editing
export function useIsMobileViewport(): boolean {
	return useMobileViewportStore((s) => s.isMobile);
}
