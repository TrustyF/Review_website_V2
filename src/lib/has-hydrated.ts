"use client";
import { useEffect } from "react";

// True once any client component has committed past its first effect (i.e.
// hydrated). Lets later mounts read localStorage during render safely,
// while the document's very first render stays server/client-identical.
let hasHydrated = false;

export function useMarkHydrated() {
	useEffect(() => {
		hasHydrated = true;
	}, []);
}

export function isHydrated() {
	return hasHydrated;
}
