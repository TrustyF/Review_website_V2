"use client";
import { RefObject, useEffect } from "react";

type Options = {
	// Only listens while true — every current call site gates this on its own
	// isOpen state, same as before this was pulled out into a shared hook.
	enabled?: boolean;
	// use-image-edit-popover.ts's own outside-click also closed on Escape;
	// the other three call sites (MediaFilterPopover, AddToListButton,
	// NavSearch) never wired that up, so it stays opt-in rather than
	// becoming new, unrequested behavior on those.
	escapeToo?: boolean;
};

// Fires `onOutside` on a click outside `ref`'s element (and optionally on
// Escape) — the same "close this popover" effect that used to be hand-
// copied into MediaFilterPopover, AddToListButton, NavSearch, and
// use-image-edit-popover.ts, each with an identical mousedown listener.
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
