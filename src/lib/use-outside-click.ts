"use client";
import { RefObject, useEffect } from "react";

type Options = {
	// Only listens while true — call sites gate this on their own isOpen state.
	enabled?: boolean;
	// Opt-in since only one of four call sites wants Escape-to-close too.
	escapeToo?: boolean;
};

// Fires `onOutside` on a click outside every given element (and optionally on Escape) — dedupes
// an identical listener from four call sites. Takes an array so a trigger portaled apart from its
// popover (see PosterQuickEditButton) can still treat a click inside either as "inside".
export function useOutsideClick(
	refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
	onOutside: () => void,
	{ enabled = true, escapeToo = false }: Options = {},
) {
	const refList = Array.isArray(refs) ? refs : [refs];

	useEffect(() => {
		if (!enabled) return;

		function handlePointerDown(e: MouseEvent) {
			const target = e.target as Node;
			const isInside = refList.some((ref) => ref.current?.contains(target));
			if (!isInside) onOutside();
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, escapeToo, onOutside, ...refList]);
}
