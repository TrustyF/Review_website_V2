"use client";
import { useEffect } from "react";

// True once any client component has ever committed past its first effect —
// which, since effects never run during SSR, only happens after hydration.
// Lets a fresh mount later in the session (e.g. a grid remounting on a
// back-navigation) know it's safe to read localStorage/sessionStorage during
// render without risking a hydration mismatch, while the very first render
// of the document stays server/client-identical.
let hasHydrated = false;

export function useMarkHydrated() {
	useEffect(() => {
		hasHydrated = true;
	}, []);
}

export function isHydrated() {
	return hasHydrated;
}
