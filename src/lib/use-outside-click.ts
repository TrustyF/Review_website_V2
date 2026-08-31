"use client";
import { RefObject, useEffect } from "react";

type Options = {
	// Only listens while true — call sites gate this on their own isOpen state.
	enabled?: boolean;
	// Opt-in since only one of four call sites wants Escape-to-close too.
	escapeToo?: boolean;
};

// Fires `onOutside` on a click outside `ref`'s element (and optionally on
// Escape) — dedupes an identical listener from four call sites.
export function useOutsideClick(
	ref: RefObject<HTMLElement | null>,
	onOutside: () => void,
	{ enabled = true, escapeToo = false }: Options = {},
) {
	useEffect(() => {
		if (!enabled) return;

		function handlePointerDown(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				onOutside();
			}
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onOutside();
		}

		document.addEventListener("mousedown", handlePointerDown);
		if (escapeToo) document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			if (escapeToo) document.removeEventListener("keydown", handleKeyDown);
		};
	}, [enabled, escapeToo, onOutside, ref]);
}
