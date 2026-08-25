"use client";
import { useMobileViewportStore } from "@/lib/mobile-viewport-store";

// Whether the viewport is currently at/below $mobile-breakpoint. Backed by
// a single app-wide matchMedia listener (see mobile-viewport-listener.tsx,
// mounted once in layout.tsx) rather than one per call site. Used
// exclusively to suppress admin editing controls on mobile — admin edits
// are intentionally unsupported there.
export function useIsMobileViewport(): boolean {
	return useMobileViewportStore((s) => s.isMobile);
}
