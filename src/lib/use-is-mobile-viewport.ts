"use client";
import { useMobileViewportStore } from "@/lib/mobile-viewport-store";

// Whether the viewport is at/below $mobile-breakpoint, backed by a single
// app-wide matchMedia listener. Used to suppress admin editing on mobile,
// which is intentionally unsupported there.
export function useIsMobileViewport(): boolean {
	return useMobileViewportStore((s) => s.isMobile);
}
