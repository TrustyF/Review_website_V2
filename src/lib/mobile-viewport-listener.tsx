"use client";
import { useEffect } from "react";
import {
	MOBILE_BREAKPOINT_PX,
	useMobileViewportStore,
} from "@/lib/mobile-viewport-store";

// Single app-wide matchMedia subscription, mounted once in layout.tsx;
// components read it via useIsMobileViewport() instead of listening themselves.
export function MobileViewportListener() {
	const setIsMobile = useMobileViewportStore((s) => s.setIsMobile);

	useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
		setIsMobile(mql.matches);
		const handleChange = () => setIsMobile(mql.matches);
		mql.addEventListener("change", handleChange);
		return () => mql.removeEventListener("change", handleChange);
	}, [setIsMobile]);

	return null;
}
