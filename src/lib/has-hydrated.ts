"use client";
import { useEffect } from "react";

// True once any client component has committed past its first effect (hydrated).
// Lets later mounts read localStorage during render while the first stays server-identical.
let hasHydrated = false;

export function useMarkHydrated() {
	useEffect(() => {
		hasHydrated = true;
	}, []);
}

export function isHydrated() {
	return hasHydrated;
}
